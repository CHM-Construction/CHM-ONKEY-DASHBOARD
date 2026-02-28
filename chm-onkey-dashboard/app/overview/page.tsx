"use client";

import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import dynamic from "next/dynamic";

const Plot = dynamic(() => import("react-plotly.js"), { ssr: false });

type WorkOrder = {
  id: number;
  properties: {
    code: string;
    assetCode: string;
    assetDescription: string;
    statusDescription: string;
    typeOfWorkDescription: string;
    createdOn: string;
    workStartedOn: string | null;
    startOn: string | null;
    completedOn: string | null;
  };
};

export default function OverviewDashboard() {
  const [timeframe, setTimeframe] = useState<'LIVE' | '24H' | '7D' | '30D'>('7D');

  const { data: workOrders = [], isLoading } = useQuery<WorkOrder[]>({
    queryKey: ['workorders'],
    queryFn: async () => {
      try {
        const ONKEY_URL = "https://core-za.onkey.app/api/tenants/vkbgroup/prd/Modules/WM/WorkOrders/?$top=50000&cid=1750243656100004&ct=true";
        const ONKEY_TOKEN = process.env.NEXT_PUBLIC_ONKEY_API_TOKEN;
        const res = await fetch(ONKEY_URL, { headers: { 'Authorization': ONKEY_TOKEN!, 'Accept': 'application/json' } });
        if (!res.ok) return [];
        const data = await res.json();
        return data.items || [];
      } catch (err) {
        return [];
      }
    },
    refetchInterval: 300000, 
  });

  const stats = useMemo(() => {
    const now = new Date().getTime();
    const DAY_MS = 24 * 60 * 60 * 1000;

    let timePeriodHours = 168; 
    if (timeframe === '24H' || timeframe === 'LIVE') timePeriodHours = 24;
    if (timeframe === '30D') timePeriodHours = 720;

    const filteredOrders = workOrders.filter(wo => {
      const status = wo.properties.statusDescription;
      if (timeframe === 'LIVE') return status !== 'Completed' && status !== 'Request to Cancel' && status !== 'Request to cancel';
      const createdTime = new Date(wo.properties.createdOn).getTime();
      const completedTime = wo.properties.completedOn ? new Date(wo.properties.completedOn).getTime() : 0;
      
      if (timeframe === '24H') return (now - createdTime <= DAY_MS) || (completedTime && (now - completedTime <= DAY_MS));
      if (timeframe === '7D') return (now - createdTime <= 7 * DAY_MS) || (completedTime && (now - completedTime <= 7 * DAY_MS));
      if (timeframe === '30D') return (now - createdTime <= 30 * DAY_MS) || (completedTime && (now - completedTime <= 30 * DAY_MS));
      return true;
    });

    const total = filteredOrders.length;
    const completed = filteredOrders.filter(w => w.properties.statusDescription === "Completed");
    const active = filteredOrders.filter(w => w.properties.statusDescription !== "Completed" && w.properties.statusDescription !== "Request to Cancel");
    
    let totalReactiveRepairTimeMs = 0;
    let totalPlannedRepairTimeMs = 0;
    let completedReactiveCount = 0;
    let overtimeCount = 0;
    
    const hourlyFailures = new Array(24).fill(0);
    const workTypeMap: Record<string, number> = {};
    const assetIssueMap: Record<string, { desc: string, count: number }> = {};
    let statusCounts = { completed: 0, inProgress: 0, backlog: 0 };

    filteredOrders.forEach(wo => {
      const type = wo.properties.typeOfWorkDescription || "Uncategorized";
      const assetCode = wo.properties.assetCode || "Unknown";
      const status = wo.properties.statusDescription || "";
      
      workTypeMap[type] = (workTypeMap[type] || 0) + 1;

      if (status === "Completed") statusCounts.completed++;
      else if (status === "Approved" || status === "Started") statusCounts.inProgress++;
      else if (status !== "Request to Cancel" && status !== "Request to cancel") statusCounts.backlog++;

      const start = wo.properties.workStartedOn || wo.properties.startOn;
      
      if (type === "Reactive") {
        if (!assetIssueMap[assetCode]) assetIssueMap[assetCode] = { desc: wo.properties.assetDescription, count: 0 };
        assetIssueMap[assetCode].count++;

        if (start && wo.properties.completedOn) {
          const startT = new Date(start).getTime();
          const endT = new Date(wo.properties.completedOn).getTime();
          
          // 🛡️ FIX 1: Prevent "Time Travel" Negative Durations
          const durationMs = Math.max(0, endT - startT);
          
          totalReactiveRepairTimeMs += durationMs;
          completedReactiveCount++;
        }

        const createdDate = new Date(wo.properties.createdOn);
        const hour = createdDate.getHours();
        const day = createdDate.getDay();
        hourlyFailures[hour]++;

        if (day === 0 || day === 6 || hour < 7 || hour >= 17) overtimeCount++;
      } else {
        if (start && wo.properties.completedOn) {
           const startT = new Date(start).getTime();
           const endT = new Date(wo.properties.completedOn).getTime();
           totalPlannedRepairTimeMs += Math.max(0, endT - startT);
        }
      }
    });

    // 🧮 FIX 2: THE CONCURRENCY PARADOX
    // Set this to the rough number of critical assets in the Mill
    const ESTIMATED_TOTAL_ASSETS = 50; 
    
    // Calculate MTTR safely
    const mttrHours = completedReactiveCount > 0 ? (totalReactiveRepairTimeMs / (1000 * 60 * 60 * completedReactiveCount)) : 0;
    const totalDowntimeHours = totalReactiveRepairTimeMs / (1000 * 60 * 60);
    
    // Total possible operating hours = (hours in timeframe) x (number of machines)
    const totalPossibleHours = timePeriodHours * ESTIMATED_TOTAL_ASSETS;
    const totalOperatingTimeHours = Math.max(0, totalPossibleHours - totalDowntimeHours);
    
    // MTBF = Total Operating Time / Number of failures
    const mtbfHours = completedReactiveCount > 0 ? (totalOperatingTimeHours / completedReactiveCount) : totalPossibleHours;

    // Availability = MTBF / (MTBF + MTTR)
    const availability = (mtbfHours + mttrHours) > 0 ? (mtbfHours / (mtbfHours + mttrHours)) * 100 : 100;

    // Breakdown Frequency (BF) = Breakdowns / Time period (days)
    const daysInPeriod = timePeriodHours / 24;
    const breakdownFreq = completedReactiveCount / Math.max(1, daysInPeriod);

    // Planned Maintenance Ratio (PMR%)
    const totalMaintenanceHours = (totalPlannedRepairTimeMs + totalReactiveRepairTimeMs) / (1000 * 60 * 60);
    const plannedHours = totalPlannedRepairTimeMs / (1000 * 60 * 60);
    const pmr = totalMaintenanceHours > 0 ? (plannedHours / totalMaintenanceHours) * 100 : 0;
    
    const topAssets = Object.entries(assetIssueMap)
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 5);

    const latestIncidents = active
      .filter(w => w.properties.typeOfWorkDescription === "Reactive")
      .sort((a, b) => new Date(b.properties.createdOn).getTime() - new Date(a.properties.createdOn).getTime())
      .slice(0, 5);

    return { 
      total, running: completed.length, 
      mttrHours: mttrHours.toFixed(1), 
      mtbfHours: mtbfHours.toFixed(1),
      availability: Math.min(100, availability).toFixed(1), // Cap at 100% max
      breakdownFreq: breakdownFreq.toFixed(1),
      pmr: pmr.toFixed(0),
      reactive: workTypeMap["Reactive"] || 0, 
      planned: total - (workTypeMap["Reactive"] || 0), 
      hourlyFailures, 
      overtimeRatio: (workTypeMap["Reactive"] || 0) > 0 ? Math.round((overtimeCount / workTypeMap["Reactive"]) * 100) : 0,
      topAssets, latestIncidents,
      workTypeLabels: Object.keys(workTypeMap),
      workTypeValues: Object.values(workTypeMap),
      statusCounts
    };
  }, [workOrders, timeframe]);

  if (isLoading) return (
    <div className="flex flex-col h-screen items-center justify-center bg-[#f4f6f8]">
      <div className="w-8 h-8 border-4 border-slate-200 border-t-[#0f172a] rounded-full animate-spin mb-4"></div>
      <div className="text-[10px] font-bold text-slate-400 tracking-widest uppercase">Aggregating Analytics...</div>
    </div>
  );

  return (
    <main className="min-h-screen p-4 md:p-8 text-slate-900 font-sans overflow-x-hidden bg-[#f4f6f8]">
      <div className="max-w-[1600px] mx-auto space-y-5">
        
        {/* HEADER & TIME-SERIES CONTROLLER */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center pb-4 border-b border-slate-200">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900 tracking-tight">Plant Analytics & Reliability</h1>
            <p className="text-sm font-medium text-slate-500 mt-1">
              Currently viewing: <span className="text-slate-700">{timeframe === 'LIVE' ? 'Active Snapshot' : timeframe === '24H' ? 'Last 24 Hours' : timeframe === '7D' ? 'Trailing 7 Days' : 'Last 30 Days'}</span>
            </p>
          </div>
          
          <div className="flex bg-slate-200/60 p-1 rounded-md mt-4 md:mt-0 border border-slate-200/50">
            {[
              { id: 'LIVE', label: 'Live' },
              { id: '24H', label: '24h' },
              { id: '7D', label: '7d' },
              { id: '30D', label: '30d' }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setTimeframe(tab.id as any)}
                className={`px-5 py-1.5 rounded text-[11px] font-bold uppercase tracking-wider transition-all duration-200 flex items-center ${
                  timeframe === tab.id 
                    ? "bg-white text-slate-900 shadow-sm border border-slate-200/50" 
                    : "text-slate-500 hover:text-slate-800 hover:bg-slate-200/50"
                }`}
              >
                {tab.id === 'LIVE' && <span className="inline-block w-1.5 h-1.5 bg-rose-500 rounded-full mr-2 animate-pulse"></span>}
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* CORE METRICS FOR MAINTENANCE MANAGEMENT */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-5 rounded-lg shadow-sm border-t-4 border-t-emerald-500 flex flex-col relative">
            <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1">Equipment Availability</h3>
            <p className="text-3xl font-black text-slate-900">{stats.availability}%</p>
            <p className="text-xs font-medium text-slate-400 mt-2">Target: &gt;90% Excellent</p>
          </div>

          <div className="bg-white p-5 rounded-lg shadow-sm border-t-4 border-t-blue-500 flex flex-col relative">
            <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1">MTBF</h3>
            <p className="text-3xl font-black text-slate-900">{stats.mtbfHours}<span className="text-lg text-slate-400 font-medium ml-1">hrs</span></p>
            <p className="text-xs font-medium text-slate-400 mt-2">Mean Time Between Failures</p>
          </div>

          <div className="bg-white p-5 rounded-lg shadow-sm border-t-4 border-t-amber-500 flex flex-col relative">
            <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1">MTTR</h3>
            <p className="text-3xl font-black text-slate-900">{stats.mttrHours}<span className="text-lg text-slate-400 font-medium ml-1">hrs</span></p>
            <p className="text-xs font-medium text-slate-400 mt-2">Mean Time To Repair</p>
          </div>

          <div className="bg-white p-5 rounded-lg shadow-sm border-t-4 border-t-rose-500 flex flex-col relative">
            <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1">Breakdown Frequency</h3>
            <p className="text-3xl font-black text-slate-900">{stats.breakdownFreq}<span className="text-lg text-slate-400 font-medium ml-1">/day</span></p>
            <p className="text-xs font-medium text-slate-400 mt-2">Avg failures per day</p>
          </div>
        </div>

        {/* ROW 2: DENSE ANALYTICS (Charts & Gauges) */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          
          {/* Work Type Donut */}
          <div className="bg-white p-5 rounded-lg shadow-sm border border-slate-200 flex flex-col">
            <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-4 text-center">Work Type Distribution</h3>
            <div className="flex-grow flex items-center justify-center relative">
              <Plot
                data={[{
                  values: stats.workTypeValues,
                  labels: stats.workTypeLabels,
                  type: 'pie',
                  hole: 0.7,
                  textinfo: 'none',
                  hovertemplate: "<b>%{label}</b><br>Count: %{value}<br>Share: %{percent}<extra></extra>",
                  marker: { colors: ['#6366f1', '#ef4444', '#10b981', '#f59e0b', '#3b82f6'] }
                }]}
                layout={{ 
                  autosize: true, height: 200, margin: { t: 0, b: 0, l: 0, r: 0 },
                  showlegend: true, legend: { orientation: 'v', x: 1, y: 0.5, font: { size: 10, color: '#64748b' } }
                }}
                useResizeHandler={true} style={{ width: "100%" }} config={{ displayModeBar: false }}
              />
            </div>
          </div>

          {/* Planned Maintenance Ratio (PMR%) Gauge */}
          <div className="bg-white p-5 rounded-lg shadow-sm border border-slate-200 flex flex-col items-center justify-center">
             <div className="w-full flex justify-between items-start mb-4">
                <h3 className="text-[10px] font-bold uppercase text-slate-500 tracking-widest">Planned Maint. Ratio (PMR)</h3>
             </div>
             <div className="relative w-32 h-32 rounded-full flex items-center justify-center" style={{ background: `conic-gradient(#6366f1 ${stats.pmr}%, #f1f5f9 0)` }}>
                <div className="w-24 h-24 bg-white rounded-full flex flex-col items-center justify-center shadow-inner">
                  <span className="text-2xl font-semibold text-slate-900 tracking-tight">{stats.pmr}%</span>
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">PMR%</span>
                </div>
              </div>
          </div>

          {/* Horizontal Status Bars */}
          <div className="bg-white p-5 rounded-lg shadow-sm border border-slate-200 flex flex-col">
            <h3 className="text-[10px] font-bold uppercase text-slate-500 tracking-widest mb-4">Workflow Funnel</h3>
            <div className="flex-grow flex flex-col justify-center space-y-4">
              <div>
                <div className="flex justify-between text-xs font-medium text-slate-600 mb-1">
                  <span>Completed</span><span>{stats.statusCounts.completed}</span>
                </div>
                <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                   <div className="bg-emerald-500 h-full rounded-full" style={{ width: `${(stats.statusCounts.completed / Math.max(stats.total, 1)) * 100}%` }}></div>
                </div>
              </div>
              <div>
                <div className="flex justify-between text-xs font-medium text-slate-600 mb-1">
                  <span>In Progress</span><span>{stats.statusCounts.inProgress}</span>
                </div>
                <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                   <div className="bg-blue-500 h-full rounded-full" style={{ width: `${(stats.statusCounts.inProgress / Math.max(stats.total, 1)) * 100}%` }}></div>
                </div>
              </div>
              <div>
                <div className="flex justify-between text-xs font-medium text-slate-600 mb-1">
                  <span>Backlog</span><span>{stats.statusCounts.backlog}</span>
                </div>
                <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                   <div className="bg-purple-500 h-full rounded-full" style={{ width: `${(stats.statusCounts.backlog / Math.max(stats.total, 1)) * 100}%` }}></div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ROW 3: TIME-SERIES FAILURE PROFILE */}
        <div className="bg-white p-5 rounded-lg shadow-sm border border-slate-200">
          <div className="flex justify-between items-center mb-2">
            <h3 className="text-[10px] font-bold uppercase text-slate-500 tracking-widest">24-Hour Failure Distribution</h3>
            <span className="text-[10px] font-semibold text-slate-400">Time-based volume analysis</span>
          </div>
          <Plot
            data={[{
              x: Array.from({length: 24}, (_, i) => `${i}:00`),
              y: stats.hourlyFailures,
              type: 'scatter',
              mode: 'lines',
              fill: 'tozeroy',
              hovertemplate: "%{y} failures at %{x}<extra></extra>",
              line: { color: '#0f172a', shape: 'spline', smoothing: 1.1, width: 2 },
              fillcolor: 'rgba(15, 23, 42, 0.05)'
            }]}
            layout={{ 
              autosize: true, height: 220, margin: { t: 10, b: 30, l: 30, r: 10 },
              xaxis: { showgrid: false, fixedrange: true, tickfont: { size: 10, color: '#94a3b8' } },
              yaxis: { gridcolor: "#f1f5f9", fixedrange: true, tickfont: { size: 10, color: '#94a3b8' }, zeroline: false },
              plot_bgcolor: "transparent", paper_bgcolor: "transparent", hovermode: 'x unified'
            }}
            useResizeHandler={true} style={{ width: "100%" }} config={{ displayModeBar: false }}
          />
        </div>

        {/* ROW 4: DATA TABLES */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 pb-8">
          
          {/* Active Breakdowns */}
          <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden flex flex-col">
            <div className="px-5 py-3 border-b border-slate-200 bg-[#f8fafc]">
              <h3 className="text-[10px] font-bold uppercase text-slate-500 tracking-widest">Active Breakdowns</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm border-collapse">
                <thead className="bg-white text-[10px] uppercase font-bold text-slate-400 tracking-widest border-b border-slate-100">
                  <tr>
                    <th className="px-5 py-3">Ticket</th>
                    <th className="px-5 py-3">Asset Description</th>
                    <th className="px-5 py-3 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {stats.latestIncidents.map((wo: any, i: number) => (
                    <tr key={i} className="hover:bg-[#f8fafc] transition-colors">
                      <td className="px-5 py-3 font-mono text-[11px] font-semibold text-slate-500">{wo.properties.code}</td>
                      <td className="px-5 py-3 font-medium text-slate-800 text-xs truncate max-w-[200px]" title={wo.properties.assetDescription}>{wo.properties.assetDescription}</td>
                      <td className="px-5 py-3 text-right">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-widest ring-1 ring-inset ring-amber-500/20 bg-amber-50 text-amber-700">
                          {wo.properties.statusDescription}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {stats.latestIncidents.length === 0 && (
                    <tr><td colSpan={3} className="px-5 py-8 text-center text-xs font-semibold text-slate-400">No active incidents in this timeframe.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Top 5 Bad Actors */}
          <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden flex flex-col">
             <div className="px-5 py-3 border-b border-slate-200 bg-[#f8fafc]">
              <h3 className="text-[10px] font-bold uppercase text-slate-500 tracking-widest">Top 5 Bad Actors</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm border-collapse">
                <thead className="bg-white text-[10px] uppercase font-bold text-slate-400 tracking-widest border-b border-slate-100">
                  <tr>
                    <th className="px-5 py-3">Asset Details</th>
                    <th className="px-5 py-3 w-1/3">Relative Impact</th>
                    <th className="px-5 py-3 text-right">Count</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {stats.topAssets.map(([assetCode, data]: [string, any]) => {
                    const maxCount = stats.topAssets[0][1].count || 1; 
                    const barWidth = `${(data.count / maxCount) * 100}%`;
                    return (
                      <tr key={assetCode} className="hover:bg-[#f8fafc] transition-colors">
                        <td className="px-5 py-3">
                          <p className="font-semibold text-slate-800 text-xs truncate max-w-[200px]" title={data.desc}>{data.desc}</p>
                          <p className="text-[10px] font-mono text-slate-400 mt-0.5">{assetCode}</p>
                        </td>
                        <td className="px-5 py-3">
                          <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                            <div className="bg-[#0f172a] h-full rounded-full transition-all" style={{ width: barWidth }}></div>
                          </div>
                        </td>
                        <td className="px-5 py-3 text-right font-semibold text-slate-600 text-xs">{data.count}</td>
                      </tr>
                    );
                  })}
                  {stats.topAssets.length === 0 && (
                    <tr><td colSpan={3} className="px-5 py-8 text-center text-xs font-semibold text-slate-400">No failures recorded.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>

      </div>
    </main>
  );
}