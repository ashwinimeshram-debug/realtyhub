"use client";

import { useState, useEffect } from "react";
import API from "@/lib/api";

const SOURCE_COLORS: Record<string, string> = {
  google: "bg-blue-500",
  facebook: "bg-blue-600",
  instagram: "bg-pink-500",
  twitter: "bg-sky-500",
  linkedin: "bg-blue-700",
  youtube: "bg-red-500",
  whatsapp: "bg-green-500",
  direct: "bg-gray-500",
  referral: "bg-purple-500",
  none: "bg-gray-400",
};

const SOURCE_ICONS: Record<string, string> = {
  google: "G",
  facebook: "f",
  instagram: "Ig",
  twitter: "X",
  linkedin: "In",
  youtube: "Yt",
  whatsapp: "Wa",
  direct: "D",
  referral: "R",
};

interface Overview {
  total_visits: number;
  unique_visitors: number;
  visits_today: number;
  visits_this_week: number;
  visits_this_month: number;
  visits_period: number;
  unique_visitors_period: number;
  leads_period: number;
  contactus_period: number;
  top_pages: { page: string; visits: number }[];
  daily_visits: { date: string; visits: number }[];
  total_contacts: number;
  contacts_this_week: number;
  contacts_this_month: number;
  total_contactus: number;
  contactus_this_week: number;
  contactus_this_month: number;
}

interface TrafficSource {
  source: string;
  visits: number;
  unique_visitors: number;
}

interface SearchInsight {
  total_searches: number;
  top_locations: { location: string; count: number }[];
  top_property_types: { type: string; count: number }[];
  budget_ranges: { range: string; count: number }[];
  daily_searches: { date: string; count: number }[];
}

interface BannerPerf {
  total_clicks: number;
  by_slide: { slide_id: number; title: string; clicks: number; unique_clicks: number }[];
  daily_clicks: { date: string; clicks: number }[];
}

export default function AnalyticsPage() {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [traffic, setTraffic] = useState<TrafficSource[]>([]);
  const [search, setSearch] = useState<SearchInsight | null>(null);
  const [banners, setBanners] = useState<BannerPerf | null>(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(30);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      API.get(`/admin/analytics?days=${days}`).catch(() => ({ data: null })),
      API.get(`/admin/analytics/traffic?days=${days}`).catch(() => ({ data: { sources: [] } })),
      API.get(`/admin/analytics/search-insights?days=${days}`).catch(() => ({ data: null })),
      API.get(`/admin/analytics/banner-performance?days=${days}`).catch(() => ({ data: null })),
    ]).then(([ov, tr, se, ba]) => {
      setOverview(ov.data);
      setTraffic(tr.data?.sources || []);
      setSearch(se.data);
      setBanners(ba.data);
    }).finally(() => setLoading(false));
  }, [days]);

  const maxBar = overview
    ? Math.max(...overview.daily_visits.map((d) => d.visits), 1)
    : 1;

  const maxSearchBar = search
    ? Math.max(...search.daily_searches.map((d) => d.count), 1)
    : 1;

  const dailyLabelEvery = overview
    ? Math.max(1, Math.ceil(overview.daily_visits.length / 14))
    : 1;

  const trafficTotal = traffic.reduce((a, b) => a + b.visits, 0);

  if (loading) {
    return (
      <div className="p-3 md:p-6 max-w-6xl mx-auto">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="bg-white rounded-xl p-3 md:p-5 animate-pulse h-24 md:h-28" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-3 md:p-6 max-w-6xl mx-auto space-y-6 md:space-y-8">
      <h1 className="text-2xl font-bold text-gray-800">Analytics</h1>
      <p className="text-sm text-gray-500 mt-1 -mb-4 md:-mb-6">Track website visits, traffic sources, and engagement</p>

      {/* Period selector */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-gray-500">Period:</span>
        {([1, 7, 30, 90] as const).map((d) => (
          <button
            key={d}
            onClick={() => setDays(d)}
            className={`px-3 py-1 rounded-lg text-sm font-medium transition ${
              days === d ? "bg-blue-600 text-white" : "bg-white text-gray-600 border border-gray-200 hover:border-gray-300"
            }`}
          >
            {d}d
          </button>
        ))}
      </div>

      {/* ═══════════ OVERVIEW ═══════════ */}
      {overview && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
            <Card label={`Visits (${days}d)`} value={overview.visits_period} color="blue" />
            <Card label={`Unique Visitors (${days}d)`} value={overview.unique_visitors_period} color="purple" />
            <Card label={`Leads (${days}d)`} value={overview.leads_period} color="amber" />
            <Card label={`Contact Us (${days}d)`} value={overview.contactus_period} color="green" />
          </div>

          {/* Visits Chart */}
          <div className="bg-white rounded-xl shadow p-4 md:p-6">
            <h2 className="text-base md:text-lg font-semibold mb-4">
              Visits — {days === 1 ? "Today" : `Last ${days} Days`}
            </h2>
            <div className="overflow-x-auto">
              <div className="flex items-end gap-1.5 min-w-[560px]" style={{ height: 160 }}>
                {overview.daily_visits.map((d, i) => {
                  const h = maxBar > 0 ? (d.visits / maxBar) * 140 : 0;
                  const showLabel = i % dailyLabelEvery === 0 || i === overview.daily_visits.length - 1;
                  return (
                    <div key={d.date} className="flex-1 flex flex-col items-center">
                      {overview.daily_visits.length <= 31 && (
                        <span className="text-xs text-gray-500 mb-1">{d.visits}</span>
                      )}
                      <div className="w-full bg-blue-500 rounded-t" style={{ height: Math.max(h, 2) }} title={`${d.date}: ${d.visits}`} />
                      {showLabel && (
                        <span className="text-[10px] text-gray-400 mt-1 whitespace-nowrap">{d.date.slice(5)}</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Leads & Contact Us */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
            <StatBox title="Leads Generated" dotColor="bg-orange-500" total={overview.total_contacts} week={overview.contacts_this_week} month={overview.contacts_this_month} />
            <StatBox title="Contact Us Submissions" dotColor="bg-teal-500" total={overview.total_contactus} week={overview.contactus_this_week} month={overview.contactus_this_month} />
          </div>

          {/* Top Pages */}
          <div className="bg-white rounded-xl shadow p-4 md:p-6">
            <h2 className="text-base md:text-lg font-semibold mb-4">Top Pages</h2>
            {overview.top_pages.length === 0 ? (
              <p className="text-gray-400 text-sm">No page visits recorded yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-gray-500 border-b">
                      <th className="pb-2 font-medium text-center">#</th>
                      <th className="pb-2 font-medium text-center">Page</th>
                      <th className="pb-2 font-medium text-center">Visits</th>
                      <th className="pb-2 font-medium text-center w-1/3 hidden sm:table-cell"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {overview.top_pages.map((p, i) => {
                      const pct = overview.total_visits > 0 ? (p.visits / overview.total_visits) * 100 : 0;
                      return (
                        <tr key={p.page} className="border-b last:border-0">
                          <td className="py-2 text-gray-400">{i + 1}</td>
                          <td className="py-2 font-mono text-gray-700 text-xs md:text-sm">{p.page}</td>
                          <td className="py-2 text-right font-semibold">{p.visits}</td>
                          <td className="py-2 pl-3 hidden sm:table-cell">
                            <div className="w-full bg-gray-100 rounded-full h-2">
                              <div className="bg-blue-500 rounded-full h-2" style={{ width: `${pct}%` }} />
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* ═══════════ TRAFFIC SOURCES ═══════════ */}
      <div className="bg-white rounded-xl shadow p-4 md:p-6">
        <h2 className="text-base md:text-lg font-semibold mb-4">Traffic Sources ({days}d)</h2>
        {traffic.length === 0 ? (
          <p className="text-gray-400 text-sm">No traffic data yet. Sources will appear as visitors arrive via Google, Facebook, Instagram, etc.</p>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 mb-4">
              {traffic.map((s) => (
                <div key={s.source} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-white text-sm font-bold ${SOURCE_COLORS[s.source] || "bg-gray-400"}`}>
                    {SOURCE_ICONS[s.source] || s.source[0]?.toUpperCase()}
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 capitalize">{s.source}</p>
                    <p className="text-lg font-bold">{s.visits.toLocaleString()}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="space-y-2">
              {traffic.map((s) => {
                const pct = trafficTotal > 0 ? (s.visits / trafficTotal) * 100 : 0;
                return (
                  <div key={s.source} className="flex items-center gap-3">
                    <span className="w-20 text-xs text-gray-500 capitalize truncate">{s.source}</span>
                    <div className="flex-1 bg-gray-100 rounded-full h-3">
                      <div className={`h-3 rounded-full ${SOURCE_COLORS[s.source] || "bg-gray-400"}`} style={{ width: `${pct}%` }} />
                    </div>
                    <span className="w-12 text-right text-xs font-semibold">{pct.toFixed(0)}%</span>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* ═══════════ SEARCH INSIGHTS ═══════════ */}
      {search && (
        <div className="bg-white rounded-xl shadow p-4 md:p-6">
          <h2 className="text-base md:text-lg font-semibold mb-4">Search Insights ({days}d)</h2>
          <p className="text-sm text-gray-500 mb-4">What users are searching for on your property search bar.</p>

          {search.total_searches === 0 ? (
            <p className="text-gray-400 text-sm">No searches recorded yet. Data appears as users use the search bar.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Top Locations */}
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-3">Most Demanded Locations</h3>
                {search.top_locations.length === 0 ? (
                  <p className="text-gray-400 text-xs">No location data</p>
                ) : (
                  <div className="space-y-2">
                    {search.top_locations.map((l, i) => {
                      const max = search.top_locations[0]?.count || 1;
                      return (
                        <div key={l.location} className="flex items-center gap-2">
                          <span className="w-5 text-xs text-gray-400">{i + 1}</span>
                          <span className="text-sm flex-1 truncate">{l.location}</span>
                          <div className="w-20 bg-gray-100 rounded-full h-2">
                            <div className="bg-emerald-500 rounded-full h-2" style={{ width: `${(l.count / max) * 100}%` }} />
                          </div>
                          <span className="text-xs font-semibold w-8 text-right">{l.count}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Top Property Types */}
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-3">Most Searched Configurations</h3>
                {search.top_property_types.length === 0 ? (
                  <p className="text-gray-400 text-xs">No type data</p>
                ) : (
                  <div className="space-y-2">
                    {search.top_property_types.map((t, i) => {
                      const max = search.top_property_types[0]?.count || 1;
                      return (
                        <div key={t.type} className="flex items-center gap-2">
                          <span className="w-5 text-xs text-gray-400">{i + 1}</span>
                          <span className="text-sm flex-1 truncate capitalize">{t.type}</span>
                          <div className="w-20 bg-gray-100 rounded-full h-2">
                            <div className="bg-blue-500 rounded-full h-2" style={{ width: `${(t.count / max) * 100}%` }} />
                          </div>
                          <span className="text-xs font-semibold w-8 text-right">{t.count}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Top Budgets */}
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-3">Most Searched Budgets</h3>
                {search.budget_ranges.length === 0 ? (
                  <p className="text-gray-400 text-xs">No budget data</p>
                ) : (
                  <div className="space-y-2">
                    {search.budget_ranges.slice(0, 10).map((b, i) => {
                      const max = search.budget_ranges[0]?.count || 1;
                      return (
                        <div key={b.range} className="flex items-center gap-2">
                          <span className="w-5 text-xs text-gray-400">{i + 1}</span>
                          <span className="text-sm flex-1 truncate">{b.range}</span>
                          <div className="w-20 bg-gray-100 rounded-full h-2">
                            <div className="bg-amber-500 rounded-full h-2" style={{ width: `${(b.count / max) * 100}%` }} />
                          </div>
                          <span className="text-xs font-semibold w-8 text-right">{b.count}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Daily searches chart */}
          {search.total_searches > 0 && (
            <div className="mt-6 pt-4 border-t border-gray-100">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Daily Searches</h3>
              <div className="overflow-x-auto">
                <div className="flex items-end gap-1 min-w-[400px]" style={{ height: 100 }}>
                  {search.daily_searches.map((d) => {
                    const h = maxSearchBar > 0 ? (d.count / maxSearchBar) * 90 : 0;
                    return (
                      <div key={d.date} className="flex-1 flex flex-col items-center">
                        {d.count > 0 && <span className="text-[10px] text-gray-400 mb-0.5">{d.count}</span>}
                        <div className="w-full bg-emerald-500 rounded-t" style={{ height: Math.max(h, 1) }} />
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ═══════════ BANNER PERFORMANCE ═══════════ */}
      {banners && (
        <div className="bg-white rounded-xl shadow p-4 md:p-6">
          <h2 className="text-base md:text-lg font-semibold mb-4">Banner / Hero Performance ({days}d)</h2>

          {banners.total_clicks === 0 ? (
            <p className="text-gray-400 text-sm">No banner clicks yet. Data appears when users click hero slide buttons.</p>
          ) : (
            <>
              <div className="mb-4 p-3 bg-purple-50 rounded-lg">
                <span className="text-sm text-gray-600">Total Clicks: </span>
                <span className="text-xl font-bold text-purple-700">{banners.total_clicks.toLocaleString()}</span>
              </div>

              {banners.by_slide.length > 0 && (
                <div className="space-y-3">
                  {banners.by_slide.map((s) => {
                    const maxClicks = banners.by_slide[0]?.clicks || 1;
                    return (
                      <div key={s.slide_id} className="flex items-center gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{s.title || `Slide #${s.slide_id}`}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <div className="flex-1 bg-gray-100 rounded-full h-2.5">
                              <div className="bg-purple-500 rounded-full h-2.5" style={{ width: `${(s.clicks / maxClicks) * 100}%` }} />
                            </div>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-sm font-bold">{s.clicks}</p>
                          <p className="text-[10px] text-gray-400">{s.unique_clicks} unique</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Daily clicks chart */}
              <div className="mt-6 pt-4 border-t border-gray-100">
                <h3 className="text-sm font-semibold text-gray-700 mb-3">Daily Banner Clicks</h3>
                <div className="overflow-x-auto">
                  <div className="flex items-end gap-1 min-w-[400px]" style={{ height: 80 }}>
                    {banners.daily_clicks.map((d) => {
                      const maxDaily = Math.max(...banners.daily_clicks.map((x) => x.clicks), 1);
                      const h = (d.clicks / maxDaily) * 70;
                      return (
                        <div key={d.date} className="flex-1 flex flex-col items-center">
                          {d.clicks > 0 && <span className="text-[10px] text-gray-400 mb-0.5">{d.clicks}</span>}
                          <div className="w-full bg-purple-500 rounded-t" style={{ height: Math.max(h, 1) }} />
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function Card({ label, value, color }: { label: string; value: number; color: string }) {
  const bg: Record<string, string> = {
    blue: "bg-blue-50 border-blue-200",
    purple: "bg-purple-50 border-purple-200",
    green: "bg-green-50 border-green-200",
    amber: "bg-amber-50 border-amber-200",
  };
  const text: Record<string, string> = {
    blue: "text-blue-700",
    purple: "text-purple-700",
    green: "text-green-700",
    amber: "text-amber-700",
  };
  return (
    <div className={`rounded-xl border p-5 ${bg[color] || bg.blue}`}>
      <p className="text-sm text-gray-500">{label}</p>
      <p className={`text-3xl font-bold mt-1 ${text[color] || text.blue}`}>{value.toLocaleString()}</p>
    </div>
  );
}

function StatBox({ title, dotColor, total, week, month }: { title: string; dotColor: string; total: number; week: number; month: number }) {
  return (
    <div className="bg-white rounded-xl shadow p-4 md:p-6">
      <h2 className="text-base md:text-lg font-semibold mb-3 md:mb-4 flex items-center gap-2">
        <span className={`w-3 h-3 rounded-full inline-block ${dotColor}`} />
        {title}
      </h2>
      <div className="grid grid-cols-3 gap-2 md:gap-4 text-center">
        <div>
          <p className="text-xl md:text-3xl font-bold">{total}</p>
          <p className="text-xs md:text-sm text-gray-500">All Time</p>
        </div>
        <div>
          <p className="text-xl md:text-3xl font-bold">{week}</p>
          <p className="text-xs md:text-sm text-gray-500">This Week</p>
        </div>
        <div>
          <p className="text-xl md:text-3xl font-bold">{month}</p>
          <p className="text-xs md:text-sm text-gray-500">This Month</p>
        </div>
      </div>
    </div>
  );
}
