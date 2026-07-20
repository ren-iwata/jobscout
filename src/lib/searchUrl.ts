// プラットフォーム検索URLの共通ビルダー（QueriesCard・JobDetailで共用）
// CW: 募集終了を除外・新着順 / Upwork: 新着順・支払確認済み・提案10件未満

export type SearchPlatform = "crowdworks" | "upwork";

export function searchUrl(platform: SearchPlatform, q: string): string {
  if (platform === "crowdworks") {
    return (
      `https://crowdworks.jp/public/jobs/search?search%5Bkeywords%5D=${encodeURIComponent(q)}` +
      `&hide_expired=true&order=new`
    );
  }
  return (
    `https://www.upwork.com/nx/search/jobs/?q=${encodeURIComponent(q)}` +
    `&sort=recency&payment_verified=1&proposals=0-4,5-9`
  );
}

/** キーワード無しの新着一覧（検索元が不明な案件の最終フォールバック） */
export function listingUrl(platform: SearchPlatform): string {
  if (platform === "crowdworks") {
    return "https://crowdworks.jp/public/jobs/search?hide_expired=true&order=new";
  }
  return "https://www.upwork.com/nx/search/jobs/?sort=recency&payment_verified=1&proposals=0-4,5-9";
}

const LAST_SEARCH_KEY = "js_last_search";
const FRESH_MS = 24 * 60 * 60 * 1000; // 「今日の検索」の有効期限

export interface LastSearch {
  platform: SearchPlatform;
  query: string;
  at: number;
}

/** ↗クリック時に呼ぶ: 直前の検索を端末に記憶（取り込み時に案件へ紐付ける） */
export function rememberSearch(platform: SearchPlatform, query: string): void {
  try {
    localStorage.setItem(LAST_SEARCH_KEY, JSON.stringify({ platform, query, at: Date.now() }));
  } catch {
    /* プライベートモード等では諦める */
  }
}

/** 取り込み画面で呼ぶ: 24時間以内の直前検索を返す */
export function recallSearch(): LastSearch | null {
  try {
    const raw = localStorage.getItem(LAST_SEARCH_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as LastSearch;
    if (!v?.platform || !v?.query || Date.now() - (v.at ?? 0) > FRESH_MS) return null;
    return v;
  } catch {
    return null;
  }
}
