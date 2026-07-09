// Minimal PubMed / PMC retrieval client written fresh for StudyDiff.
//
// Three entry points: search (PMIDs for a query), abstract (structured summary),
// and fullText (PMC body text, only for the Open Access subset). fetchPaper ties
// them together and tags how deep we managed to read – `sourceDepth` – because a
// claim can only be grounded against text we actually retrieved.
//
// Design note learned the hard way: an article being *free to read* on PMC does
// NOT mean its body text is retrievable via E-utilities. Only the Open Access
// subset returns full text; everything else falls back to the abstract, and we
// surface that honestly rather than pretending we read the methods.

const EUTILS = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils';
const EMAIL = process.env.NCBI_EMAIL || 'studydiff@example.com';
const API_KEY = process.env.NCBI_API_KEY || '';

const withKey = (params) => {
  const p = new URLSearchParams({ tool: 'studydiff', email: EMAIL, ...params });
  if (API_KEY) p.set('api_key', API_KEY);
  return p.toString();
};

async function getJSON(url) {
  const r = await fetch(url, { signal: AbortSignal.timeout(15000) });
  if (!r.ok) throw new Error(`NCBI ${r.status} for ${url}`);
  return r.json();
}
async function getText(url) {
  const r = await fetch(url, { signal: AbortSignal.timeout(15000) });
  if (!r.ok) throw new Error(`NCBI ${r.status} for ${url}`);
  return r.text();
}

/** Search PubMed; returns an array of PMIDs (strings). */
export async function search(query, { retmax = 10 } = {}) {
  const url = `${EUTILS}/esearch.fcgi?${withKey({ db: 'pubmed', term: query, retmode: 'json', retmax: String(retmax), sort: 'relevance' })}`;
  const j = await getJSON(url);
  return j?.esearchresult?.idlist ?? [];
}

/** Resolve a DOI to a PMID via PubMed (searches the article-id index). */
export async function resolveDoiToPmid(doi) {
  const clean = String(doi).replace(/^https?:\/\/(dx\.)?doi\.org\//i, '').trim();
  let ids = await search(`${clean}[AID]`, { retmax: 1 });
  if (!ids.length) ids = await search(clean, { retmax: 1 });
  if (!ids.length) throw new Error(`No PubMed record found for DOI ${clean}.`);
  return ids[0];
}

const firstTag = (xml, tag) => {
  const m = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'i'));
  return m ? m[1].replace(/<[^>]+>/g, '').trim() : '';
};
const allTags = (xml, tag) => {
  const out = [];
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'gi');
  let m;
  while ((m = re.exec(xml))) out.push(m[1].replace(/<[^>]+>/g, '').trim());
  return out;
};

/**
 * Fetch a structured-ish abstract for a PMID via efetch XML.
 * @returns {Promise<{pmid,title,journal,year,citation,abstract,pmcid}>}
 */
export async function abstract(pmid) {
  const url = `${EUTILS}/efetch.fcgi?${withKey({ db: 'pubmed', id: pmid, retmode: 'xml', rettype: 'abstract' })}`;
  const xml = await getText(url);
  const title = firstTag(xml, 'ArticleTitle');
  const journal = firstTag(xml, 'ISOAbbreviation') || firstTag(xml, 'Title');
  const year = firstTag(xml, 'Year');
  // AbstractText can appear several times with a Label attribute; join them.
  const paras = allTags(xml, 'AbstractText');
  const abstractText = paras.join('\n\n');
  const lastName = firstTag(xml, 'LastName');
  const citation = [lastName ? `${lastName} et al.` : '', year, journal].filter(Boolean).join(' ');
  const pmcid = (xml.match(/<ArticleId IdType="pmc">(PMC\d+)<\/ArticleId>/i) || [])[1] || '';
  return { pmid, title, journal, year, citation, abstract: abstractText, pmcid };
}

/**
 * Fetch PMC full-text body for an OA-subset article. Returns null when the
 * article is not in the OA subset (efetch yields no <body>).
 * @returns {Promise<string|null>}
 */
export async function fullText(pmcid) {
  if (!pmcid) return null;
  const id = pmcid.replace(/^PMC/i, '');
  const url = `${EUTILS}/efetch.fcgi?${withKey({ db: 'pmc', id, retmode: 'xml' })}`;
  const xml = await getText(url);
  const body = xml.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  if (!body) return null;
  const text = body[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  return text.length > 200 ? text : null;
}

/**
 * Retrieve the best available source text for a PMID and report how deep we got.
 * @returns {Promise<{pmid,citation,title,text,sourceDepth:'fulltext'|'abstract'}>}
 */
export async function fetchPaper(pmid) {
  const a = await abstract(pmid);
  let text = a.abstract;
  let sourceDepth = 'abstract';
  if (a.pmcid) {
    const body = await fullText(a.pmcid).catch(() => null);
    if (body) {
      text = `${a.abstract}\n\n${body}`;
      sourceDepth = 'fulltext';
    }
  }
  return { pmid, citation: a.citation, title: a.title, text, sourceDepth };
}
