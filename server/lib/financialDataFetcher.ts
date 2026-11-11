/**
 * Provider-Agnostic Financial & News Data Fetcher
 * Retrieves real SEC EDGAR filings, Yahoo Finance historical prices/fundamentals,
 * and recent 2-4 week news articles from public feeds without requiring proprietary LLM tools.
 */

const SEC_USER_AGENT = "TickrResearchTerminal/1.0 (research@tickr-terminal.local)";
const BROWSER_USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

export interface SecFilingItem {
  form: string;
  filingDate: string;
  reportDate: string;
  accessionNumber: string;
  primaryDocument: string;
  description: string;
  url: string;
}

export interface NewsArticleItem {
  title: string;
  source: string;
  pubDate: string;
  link: string;
  snippet: string;
}

export interface PricePoint {
  date: string;
  price: number;
}

export interface QuarterMetric {
  quarter: string;
  revenue?: number;
  net_income?: number;
  distributions?: number;
}

let cachedTickersMap: Record<string, { cik: string; title: string }> | null = null;
let cachedTickersTimestamp = 0;

async function getCikForTicker(ticker: string): Promise<{ cik: string; title: string } | null> {
  const upper = ticker.toUpperCase().trim();
  const now = Date.now();
  if (!cachedTickersMap || now - cachedTickersTimestamp > 1000 * 60 * 60) {
    try {
      const resp = await fetch("https://www.sec.gov/files/company_tickers.json", {
        headers: { "User-Agent": SEC_USER_AGENT, Accept: "application/json" },
        signal: AbortSignal.timeout(8000),
      });
      if (resp.ok) {
        const data = await resp.json();
        const map: Record<string, { cik: string; title: string }> = {};
        for (const key of Object.keys(data)) {
          const entry = data[key];
          if (entry && entry.ticker) {
            map[String(entry.ticker).toUpperCase()] = {
              cik: String(entry.cik_str).padStart(10, "0"),
              title: String(entry.title || entry.ticker),
            };
          }
        }
        cachedTickersMap = map;
        cachedTickersTimestamp = now;
      }
    } catch (err) {
      console.warn("[financialDataFetcher] Failed to load SEC company_tickers.json:", err);
    }
  }
  return cachedTickersMap?.[upper] || null;
}

export async function fetchSecFilings(ticker: string): Promise<{
  companyName: string;
  cik: string | null;
  filings: SecFilingItem[];
  quarterlyFinancials: QuarterMetric[];
}> {
  const info = await getCikForTicker(ticker);
  const filings: SecFilingItem[] = [];
  const quarterlyFinancials: QuarterMetric[] = [];

  if (info) {
    const { cik, title } = info;
    const numericCik = String( parseInt(cik, 10) );
    try {
      const subResp = await fetch(`https://data.sec.gov/submissions/CIK${cik}.json`, {
        headers: { "User-Agent": SEC_USER_AGENT, Accept: "application/json" },
        signal: AbortSignal.timeout(9000),
      });
      if (subResp.ok) {
        const subData = await subResp.json();
        const recent = subData?.filings?.recent;
        if (recent && Array.isArray(recent.form)) {
          const targetForms = new Set([
            "10-K",
            "10-Q",
            "8-K",
            "DEF 14A",
            "4",
            "3",
            "5",
            "N-CSR",
            "N-CSRS",
            "N-PORT-P",
            "485BPOS",
            "20-F",
            "6-K",
          ]);
          for (let i = 0; i < recent.form.length && filings.length < 12; i++) {
            const form = String(recent.form[i] || "");
            if (!targetForms.has(form)) continue;
            const accession = String(recent.accessionNumber?.[i] || "");
            const cleanAcc = accession.replace(/-/g, "");
            const primaryDoc = String(recent.primaryDocument?.[i] || "");
            const filingDate = String(recent.filingDate?.[i] || "");
            const reportDate = String(recent.reportDate?.[i] || filingDate);
            const desc = String(recent.primaryDocDescription?.[i] || `SEC Form ${form}`);
            const url = primaryDoc
              ? `https://www.sec.gov/Archives/edgar/data/${numericCik}/${cleanAcc}/${primaryDoc}`
              : `https://www.sec.gov/edgar/browse/?CIK=${cik}`;

            filings.push({
              form: `Form ${form}`,
              filingDate,
              reportDate,
              accessionNumber: accession,
              primaryDocument: primaryDoc,
              description: desc,
              url,
            });
          }
        }
      }
    } catch (err) {
      console.warn(`[financialDataFetcher] Error fetching submissions for ${ticker}:`, err);
    }

    // Try fetching XBRL Company Facts for quarterly revenue & net income
    try {
      const factsResp = await fetch(`https://data.sec.gov/api/xbrl/companyfacts/CIK${cik}.json`, {
        headers: { "User-Agent": SEC_USER_AGENT, Accept: "application/json" },
        signal: AbortSignal.timeout(9000),
      });
      if (factsResp.ok) {
        const factsData = await factsResp.json();
        const usGaap = factsData?.facts?.["us-gaap"] || {};
        const revConcept =
          usGaap.Revenues?.units?.USD ||
          usGaap.RevenueFromContractWithCustomerExcludingAssessedTax?.units?.USD ||
          usGaap.SalesRevenueNet?.units?.USD ||
          [];
        const niConcept = usGaap.NetIncomeLoss?.units?.USD || [];

        // Filter to quarterly ~90-day duration entries
        const filterQuarterly = (arr: any[]) =>
          arr
            .filter((item) => {
              if (!item.start || !item.end || typeof item.val !== "number") return false;
              const days =
                (new Date(item.end).getTime() - new Date(item.start).getTime()) /
                (1000 * 3600 * 24);
              return days >= 75 && days <= 105;
            })
            .sort((a, b) => String(a.end).localeCompare(String(b.end)));

        const qRevs = filterQuarterly(revConcept);
        const qNis = filterQuarterly(niConcept);

        // Deduplicate by end date
        const revByEnd = new Map<string, { val: number; fp: string; fy: number }>();
        for (const r of qRevs) {
          revByEnd.set(r.end, { val: r.val, fp: r.fp || "Q", fy: r.fy });
        }
        const niByEnd = new Map<string, number>();
        for (const n of qNis) {
          niByEnd.set(n.end, n.val);
        }

        const recentEnds = Array.from(revByEnd.keys()).slice(-4);
        for (const end of recentEnds) {
          const revObj = revByEnd.get(end)!;
          const niVal = niByEnd.get(end) ?? 0;
          const dateObj = new Date(end);
          const qNum = Math.floor(dateObj.getUTCMonth() / 3) + 1;
          const year = dateObj.getUTCFullYear();
          quarterlyFinancials.push({
            quarter: `Q${qNum} ${year}`,
            revenue: Number((revObj.val / 1e9).toFixed(2)),
            net_income: Number((niVal / 1e9).toFixed(2)),
          });
        }
      }
    } catch (err) {
      // Ignore XBRL errors for ETFs/foreign issuers
    }

    return {
      companyName: title,
      cik,
      filings,
      quarterlyFinancials,
    };
  }

  // Fallback: EFTS search for ETFs or tickers not in company_tickers.json
  try {
    const eftsUrl = `https://efts.sec.gov/LATEST/search-index?q=%22${encodeURIComponent(
      ticker
    )}%22&forms=10-K,10-Q,8-K,N-CSR,N-CSRS,485BPOS`;
    const eftsResp = await fetch(eftsUrl, {
      headers: { "User-Agent": SEC_USER_AGENT, Accept: "application/json" },
      signal: AbortSignal.timeout(8000),
    });
    if (eftsResp.ok) {
      const eftsData = await eftsResp.json();
      const hits = eftsData?.hits?.hits || [];
      for (const hit of hits.slice(0, 10)) {
        const src = hit._source || {};
        const form = src.form || "SEC Filing";
        const filingDate = src.file_date || "";
        const reportDate = src.period_ending || filingDate;
        const ciks = src.ciks || [];
        const cikStr = ciks[0] ? String(parseInt(ciks[0], 10)) : "";
        const adsh = String(src.adsh || "").replace(/-/g, "");
        const docName = String(hit._id || "").split(":")[1] || "";
        const url =
          cikStr && adsh && docName
            ? `https://www.sec.gov/Archives/edgar/data/${cikStr}/${adsh}/${docName}`
            : `https://www.sec.gov/edgar/searchedgar/companysearch`;

        filings.push({
          form: `Form ${form}`,
          filingDate,
          reportDate,
          accessionNumber: src.adsh || "",
          primaryDocument: docName,
          description: (src.display_names && src.display_names[0]) || `Form ${form}`,
          url,
        });
      }
    }
  } catch (err) {
    console.warn(`[financialDataFetcher] EFTS fallback error for ${ticker}:`, err);
  }

  return {
    companyName: ticker.toUpperCase(),
    cik: null,
    filings,
    quarterlyFinancials,
  };
}

export async function fetchStockPriceAndDistributions(ticker: string): Promise<{
  stockPrice4m: PricePoint[];
  distributions4q: QuarterMetric[];
  currency: string;
  regularMarketPrice?: number;
}> {
  const stockPrice4m: PricePoint[] = [];
  const distributions4q: QuarterMetric[] = [];
  let currency = "USD";
  let regularMarketPrice: number | undefined;

  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
      ticker
    )}?range=1y&interval=1mo&events=div`;
    const resp = await fetch(url, {
      headers: { "User-Agent": BROWSER_USER_AGENT, Accept: "application/json" },
      signal: AbortSignal.timeout(8000),
    });

    if (resp.ok) {
      const data = await resp.json();
      const result = data?.chart?.result?.[0];
      if (result) {
        currency = result.meta?.currency || "USD";
        regularMarketPrice = result.meta?.regularMarketPrice;
        const timestamps: number[] = result.timestamp || [];
        const closes: (number | null)[] = result.indicators?.quote?.[0]?.close || [];

        const validPoints: { ts: number; price: number }[] = [];
        for (let i = 0; i < timestamps.length; i++) {
          const c = closes[i];
          if (typeof c === "number" && !isNaN(c)) {
            validPoints.push({ ts: timestamps[i] * 1000, price: Number(c.toFixed(2)) });
          }
        }

        const last4 = validPoints.slice(-4);
        const monthNames = [
          "Jan",
          "Feb",
          "Mar",
          "Apr",
          "May",
          "Jun",
          "Jul",
          "Aug",
          "Sep",
          "Oct",
          "Nov",
          "Dec",
        ];
        for (const pt of last4) {
          const d = new Date(pt.ts);
          const label = `${monthNames[d.getUTCMonth()]} '${String(d.getUTCFullYear()).slice(-2)}`;
          stockPrice4m.push({ date: label, price: pt.price });
        }

        // Extract dividends if ETF or dividend payer
        const divEvents = result.events?.dividends;
        if (divEvents && typeof divEvents === "object") {
          const divs = Object.values(divEvents)
            .map((d: any) => ({
              date: Number(d.date) * 1000,
              amount: Number(d.amount),
            }))
            .filter((d) => !isNaN(d.amount))
            .sort((a, b) => a.date - b.date)
            .slice(-4);

          for (const dv of divs) {
            const dt = new Date(dv.date);
            const q = Math.floor(dt.getUTCMonth() / 3) + 1;
            distributions4q.push({
              quarter: `Q${q} ${dt.getUTCFullYear()}`,
              distributions: Number(dv.amount.toFixed(3)),
            });
          }
        }
      }
    }
  } catch (err) {
    console.warn(`[financialDataFetcher] Yahoo Finance fetch failed for ${ticker}:`, err);
  }

  return { stockPrice4m, distributions4q, currency, regularMarketPrice };
}

function decodeHtmlEntities(str: string): string {
  return str
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export async function fetchRecentNewsArticles(
  ticker: string,
  timeframe: string = "2 to 4 weeks"
): Promise<NewsArticleItem[]> {
  const days = timeframe.includes("2 week")
    ? 14
    : timeframe.includes("3 week")
    ? 21
    : 28;

  const articles: NewsArticleItem[] = [];

  try {
    const query = encodeURIComponent(`${ticker} stock financial news when:${days}d`);
    const rssUrl = `https://news.google.com/rss/search?q=${query}&hl=en-US&gl=US&ceid=US:en`;
    const resp = await fetch(rssUrl, {
      headers: { "User-Agent": BROWSER_USER_AGENT },
      signal: AbortSignal.timeout(8000),
    });

    if (resp.ok) {
      const xml = await resp.text();
      const itemMatches = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)];
      for (const match of itemMatches.slice(0, 12)) {
        const block = match[1];
        const rawTitle = block.match(/<title>([\s\S]*?)<\/title>/)?.[1] || "";
        const rawLink = block.match(/<link>([\s\S]*?)<\/link>/)?.[1] || "";
        const rawPubDate = block.match(/<pubDate>([\s\S]*?)<\/pubDate>/)?.[1] || "";
        const rawSource = block.match(/<source[^>]*>([\s\S]*?)<\/source>/)?.[1] || "Financial Press";
        const rawDesc = block.match(/<description>([\s\S]*?)<\/description>/)?.[1] || "";

        let cleanTitle = decodeHtmlEntities(rawTitle);
        const cleanSource = decodeHtmlEntities(rawSource);
        // Strip trailing " - Source" from Google News titles
        if (cleanSource && cleanTitle.endsWith(` - ${cleanSource}`)) {
          cleanTitle = cleanTitle.slice(0, -` - ${cleanSource}`.length).trim();
        }

        let formattedDate = rawPubDate;
        if (rawPubDate) {
          const parsed = new Date(rawPubDate);
          if (!isNaN(parsed.getTime())) {
            formattedDate = parsed.toISOString().split("T")[0];
          }
        }

        articles.push({
          title: cleanTitle,
          source: cleanSource,
          pubDate: formattedDate,
          link: rawLink.trim(),
          snippet: decodeHtmlEntities(rawDesc).slice(0, 260),
        });
      }
    }
  } catch (err) {
    console.warn(`[financialDataFetcher] News RSS fetch error for ${ticker}:`, err);
  }

  return articles;
}
