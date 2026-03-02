"use client";

import { useMemo, Suspense } from "react";
import { useQuery } from "@tanstack/react-query";
import dynamic from "next/dynamic";
import { useQueryState, parseAsString } from 'nuqs';

const Plot = dynamic(() => import("react-plotly.js"), { ssr: false });

type WorkOrder = {
  id: number;
  properties: {
    code: string;
    description: string; // 🛠️ NEW: The actual Task Description
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

// 🚦 Priority Configuration
const PRIORITIES = {
  Critical: { label: 'Critical', desc: 'Immediate action will cause plant stoppage or safety risk', color: 'bg-rose-100 text-rose-700 border-rose-200', dot: 'bg-rose-500' },
  Major: { label: 'Major', desc: 'High priority could cause plant stoppage or safety risk', color: 'bg-amber-100 text-amber-700 border-amber-200', dot: 'bg-amber-500' },
  Medium: { label: 'Medium', desc: 'Priority could cause problems within due time', color: 'bg-blue-100 text-blue-700 border-blue-200', dot: 'bg-blue-500' },
  Low: { label: 'Low', desc: 'Would be nice to complete', color: 'bg-slate-100 text-slate-600 border-slate-200', dot: 'bg-slate-400' }
};

type PriorityKey = keyof typeof PRIORITIES;

function PMPlanLogic() {
  const [viewMode, setViewMode] = useQueryState('view', parseAsString.withDefault('week').withOptions({ shallow: true }));

  // 📡 DATA PIPELINE
  const { data: workOrders = [], isLoading } = useQuery<WorkOrder[]>({
    queryKey: ['workorders_pm'],
    queryFn: async () => {
      try {
        const ONKEY_URL = "https://core-za.onkey.app/api/tenants/vkbgroup/prd/Modules/WM/WorkOrders/?$top=50000&cid=1750243656100004&ct=true";
        const ONKEY_TOKEN = process.env.NEXT_PUBLIC_ONKEY_API_TOKEN || "";
        const res = await fetch(ONKEY_URL, { headers: { 'Authorization': ONKEY_TOKEN, 'Accept': 'application/json' } });
        if (!res.ok) return [];
        const data = await res.json();
        return data?.items || [];
      } catch (error) {
        return [];
      }
    },
    refetchInterval: 300000 
  });

  // 🧠 THE PM MATH ENGINE
  const pmData = useMemo(() => {
    const now = new Date();
    
    // Helper to intelligently guess Priority based on BOTH Asset and Task descriptions
    const determinePriority = (wo: WorkOrder): PriorityKey => {
      const assetDesc = (wo.properties.assetDescription || "").toLowerCase();
      const taskDesc = (wo.properties.description || "").toLowerCase();
      const type = (wo.properties.typeOfWorkDescription || "").toLowerCase();
      
      const fullContext = `${assetDesc} ${taskDesc} ${type}`;

      // Critical Triggers
      if (fullContext.includes('scale') || fullContext.includes('bopp') || fullContext.includes('statutory') || fullContext.includes('safety') || fullContext.includes('main load') || fullContext.includes('trip')) return 'Critical';
      // Major Triggers
      if (fullContext.includes('mill') || fullContext.includes('screw') || fullContext.includes('sifter') || fullContext.includes('calibration') || fullContext.includes('replace') || fullContext.includes('motor')) return 'Major';
      // Low Triggers
      if (fullContext.includes('general') || fullContext.includes('building') || fullContext.includes('paint') || fullContext.includes('cleaning') || fullContext.includes('sweep')) return 'Low';
      // Default
      return 'Medium';
    };

    let completedOnTime = 0;
    let totalScheduledThisWeek = 0;

    // Data Structures
    const weekDays: Record<number, any[]> = { 1: [], 2: [], 3: [], 4: [], 5: [], 6: [], 0: [] };
    const workloadForecast = new Array(7).fill(0);
    const backlogItems: any[] = [];

    // Isolate ONLY Planned / Preventive Maintenance
    workOrders.forEach(wo => {
      const type = wo.properties.typeOfWorkDescription || "";
      const status = wo.properties.statusDescription || "";
      
      if (type !== 'Reactive' && status.toLowerCase() !== 'request to cancel') {
        const scheduledDate = wo.properties.startOn ? new Date(wo.properties.startOn) : new Date(wo.properties.createdOn);
        const isCompleted = status === 'Completed';
        const priority = determinePriority(wo);
        
        const mappedWO = { ...wo, scheduledDate, isCompleted, priority };

        // 1. Calculate Backlog
        if (!isCompleted && scheduledDate < now) {
          backlogItems.push(mappedWO);
        }

        // 2. Map Current Week Calendar
        const dayDiff = Math.floor((scheduledDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        if (dayDiff >= -7 && dayDiff <= 7) {
          totalScheduledThisWeek++;
          
          if (isCompleted && wo.properties.completedOn) {
             const compDate = new Date(wo.properties.completedOn);
             if (compDate.getTime() <= scheduledDate.getTime() + (24 * 60 * 60 * 1000)) completedOnTime++;
          }

          const dayOfWeek = scheduledDate.getDay();
          if (weekDays[dayOfWeek] && dayDiff >= 0 && dayDiff < 7) {
            weekDays[dayOfWeek].push(mappedWO);
            workloadForecast[dayOfWeek === 0 ? 6 : dayOfWeek - 1] += 1.5; 
          }
        }
      }
    });

    const scheduleCompliance = totalScheduledThisWeek > 0 ? Math.round((completedOnTime / totalScheduledThisWeek) * 100) : 100;

    // Group Backlog by Priority
    const groupedBacklog = { Critical: [], Major: [], Medium: [], Low: [] } as Record<PriorityKey, any[]>;
    backlogItems.forEach(item => {
      groupedBacklog[item.priority as PriorityKey].push(item);
    });

    return { 
      totalScheduledThisWeek, backlogItems, groupedBacklog, scheduleCompliance, weekDays, workloadForecast
    };
  }, [workOrders]);

  if (isLoading) return (
    <div className="flex flex-col h-screen items-center justify-center bg-[#f4f6f8]">
      <div className="w-8 h-8 border-4 border-slate-200 border-t-purple-600 rounded-full animate-spin mb-4"></div>
      <div className="text-[10px] font-bold text-slate-400 tracking-widest uppercase">Building PM Plan...</div>
    </div>
  );

  return (
    <div className="max-w-[1800px] mx-auto w-full flex flex-col h-full shrink-0">
      
      {/* HEADER */}
      <header className="mb-5 shrink-0 pt-2 pb-4 border-b border-slate-200 flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 tracking-tight">PM Schedule & Compliance</h1>
          <p className="text-sm text-slate-500 mt-1 font-medium">Proactive maintenance tracking and execution plan.</p>
        </div>
        <div className="flex bg-slate-200/60 p-1 rounded-md border border-slate-200/50">
          <button onClick={() => setViewMode('week')} className={`px-5 py-1.5 rounded text-[11px] font-bold uppercase tracking-wider transition-all ${viewMode === 'week' ? "bg-white text-slate-900 shadow-sm border border-slate-200/50" : "text-slate-500"}`}>Week Calendar</button>
          <button onClick={() => setViewMode('backlog')} className={`px-5 py-1.5 rounded text-[11px] font-bold uppercase tracking-wider transition-all ${viewMode === 'backlog' ? "bg-white text-rose-700 shadow-sm border border-slate-200/50" : "text-slate-500"}`}>Priority Backlog</button>
        </div>
      </header>

      {/* 🚀 CORE PM KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-white p-5 rounded-lg shadow-sm border border-slate-200 flex flex-col relative overflow-hidden">
          <div className="absolute right-0 top-0 bottom-0 w-2 bg-emerald-500"></div>
          <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1">Schedule Compliance</h3>
          <div className="flex items-end gap-2">
            <p className="text-4xl font-black text-slate-900 tracking-tight">{pmData.scheduleCompliance}%</p>
            <p className="text-xs font-bold text-emerald-600 mb-1.5">Target &gt;90%</p>
          </div>
          <p className="text-xs font-medium text-slate-400 mt-1">PMs completed on schedule</p>
        </div>

        <div className="bg-white p-5 rounded-lg shadow-sm border border-slate-200 flex flex-col">
          <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1">Active PM Backlog</h3>
          <p className="text-4xl font-black text-rose-600 tracking-tight">{pmData.backlogItems.length}</p>
          <p className="text-xs font-medium text-slate-400 mt-1">Tickets overdue for execution</p>
        </div>

        <div className="bg-white p-5 rounded-lg shadow-sm border border-slate-200 flex flex-col">
          <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1">Scheduled This Week</h3>
          <p className="text-4xl font-black text-slate-900 tracking-tight">{pmData.totalScheduledThisWeek}</p>
          <p className="text-xs font-medium text-slate-400 mt-1">Upcoming inspections & services</p>
        </div>

        <div className="bg-white p-5 rounded-lg shadow-sm border border-slate-200 flex flex-col">
          <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1">Critical Risks</h3>
          <p className="text-4xl font-black text-rose-600 tracking-tight">{pmData.groupedBacklog.Critical.length}</p>
          <p className="text-xs font-medium text-slate-400 mt-1">Overdue Critical PMs</p>
        </div>
      </div>

      {viewMode === 'week' ? (
        <div className="flex flex-col flex-grow">
          {/* Workload Projection Chart */}
          <div className="bg-white p-4 rounded-lg shadow-sm border border-slate-200 mb-6 shrink-0 h-48">
            <div className="flex justify-between items-center mb-2 border-b border-slate-100 pb-2">
              <h3 className="text-[10px] font-bold uppercase text-slate-500 tracking-widest">Labor Forecast (Est. Hours)</h3>
            </div>
            <Plot
              data={[{
                x: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
                y: pmData.workloadForecast,
                type: 'bar',
                marker: { color: '#8b5cf6' },
                hovertemplate: "%{y} hrs<extra></extra>"
              }]}
              layout={{ 
                autosize: true, height: 120, margin: { t: 0, b: 20, l: 30, r: 10 },
                xaxis: { showgrid: false, tickfont: { size: 10, color: '#64748b' } },
                yaxis: { gridcolor: "#f1f5f9", tickfont: { size: 10, color: '#94a3b8' } },
                plot_bgcolor: "transparent", paper_bgcolor: "transparent"
              }}
              useResizeHandler={true} style={{ width: "100%" }} config={{ displayModeBar: false }}
            />
          </div>

          {/* THE 7-DAY KANBAN CALENDAR */}
          <div className="flex gap-4 overflow-x-auto pb-4 flex-grow hide-scrollbar">
            {[
              { id: 1, name: 'Monday' }, { id: 2, name: 'Tuesday' }, { id: 3, name: 'Wednesday' },
              { id: 4, name: 'Thursday' }, { id: 5, name: 'Friday' }, { id: 6, name: 'Saturday' }, { id: 0, name: 'Sunday' }
            ].map(day => (
              <div key={day.id} className="min-w-[280px] flex-1 bg-slate-200/50 rounded-lg flex flex-col border border-slate-200/50 overflow-hidden">
                <div className="bg-white p-3 border-b border-slate-200 flex justify-between items-center shadow-sm z-10">
                  <h3 className="text-sm font-bold text-slate-800">{day.name}</h3>
                  <span className="text-[10px] bg-slate-100 px-2 py-0.5 rounded font-black text-slate-500">{pmData.weekDays[day.id].length}</span>
                </div>
                
                <div className="p-3 overflow-y-auto flex-grow space-y-3">
                  {pmData.weekDays[day.id].map(wo => {
                    const pConfig = PRIORITIES[wo.priority as PriorityKey];
                    return (
                      <div key={wo.id} className="bg-white p-3 rounded shadow-sm border border-slate-200 hover:border-purple-400 transition-colors group cursor-pointer relative overflow-hidden flex flex-col">
                        <div className={`absolute top-0 left-0 w-1 bottom-0 ${pConfig.dot}`}></div>
                        <div className="pl-2 flex-grow">
                          <div className="flex justify-between items-start mb-2">
                            <span className="font-mono text-[10px] font-bold text-slate-400 group-hover:text-purple-600">{wo.properties.code}</span>
                            <span className={`text-[8px] px-1.5 py-0.5 rounded font-black uppercase border ${pConfig.color}`}>
                              {pConfig.label}
                            </span>
                          </div>
                          
                          {/* 🛠️ NEW: Asset Location Sub-header & Bold Task Description */}
                          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1 truncate" title={wo.properties.assetDescription}>
                            📍 {wo.properties.assetDescription || 'Unknown Asset'}
                          </p>
                          <p className="text-xs font-bold text-slate-900 leading-tight mb-2 line-clamp-3" title={wo.properties.description}>
                            {wo.properties.description || 'No task description provided'}
                          </p>

                          <div className="flex justify-between items-center mt-2 pt-2 border-t border-slate-50">
                            <span className="text-[9px] font-bold text-slate-400 uppercase">{wo.properties.typeOfWorkDescription || 'PM'}</span>
                            {wo.isCompleted && <span className="text-[9px] font-bold text-emerald-500 uppercase flex items-center gap-1"><svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg> Done</span>}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  {pmData.weekDays[day.id].length === 0 && (
                    <div className="h-20 border-2 border-dashed border-slate-300 rounded flex items-center justify-center">
                      <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">No PMs</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        /* 🚥 THE PRIORITY BACKLOG BOARD */
        <div className="flex gap-4 overflow-x-auto pb-4 flex-grow hide-scrollbar">
          {(['Critical', 'Major', 'Medium', 'Low'] as PriorityKey[]).map(priority => {
            const items = pmData.groupedBacklog[priority];
            const pConfig = PRIORITIES[priority];
            
            return (
              <div key={priority} className="min-w-[320px] flex-1 bg-white rounded-lg flex flex-col border border-slate-200 shadow-sm overflow-hidden">
                <div className={`p-4 border-b border-slate-200 flex flex-col justify-center ${priority === 'Critical' ? 'bg-rose-50' : priority === 'Major' ? 'bg-amber-50' : 'bg-slate-50'}`}>
                  <div className="flex justify-between items-center mb-1">
                    <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${pConfig.dot}`}></span>
                      {pConfig.label} Priority
                    </h3>
                    <span className={`text-[11px] px-2 py-0.5 rounded-full font-black ${pConfig.color}`}>{items.length}</span>
                  </div>
                  <p className="text-[9px] font-semibold uppercase tracking-widest text-slate-500">{pConfig.desc}</p>
                </div>
                
                <div className="p-3 overflow-y-auto flex-grow space-y-3 bg-slate-50">
                  {items.map(wo => (
                    <div key={wo.id} className="bg-white p-3 rounded shadow-sm border border-slate-200 hover:border-slate-300 transition-colors">
                      <div className="flex justify-between items-start mb-2">
                        <span className="font-mono text-[10px] font-bold text-slate-500">{wo.properties.code}</span>
                        <span className="text-[9px] font-bold text-rose-500 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-100 flex items-center gap-1">
                           <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                           OVERDUE
                        </span>
                      </div>
                      
                      {/* 🛠️ NEW: Asset Location Sub-header & Bold Task Description */}
                      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1 truncate" title={wo.properties.assetDescription}>
                        📍 {wo.properties.assetDescription || 'Unknown Asset'}
                      </p>
                      <p className="text-xs font-bold text-slate-900 leading-tight mb-2" title={wo.properties.description}>
                        {wo.properties.description || 'No task description provided'}
                      </p>

                      <div className="flex justify-between items-center mt-2 pt-2 border-t border-slate-100">
                        <span className="text-[9px] font-bold text-slate-400 uppercase">{wo.properties.typeOfWorkDescription || 'PM'}</span>
                        <span className="text-[9px] font-medium text-slate-500">Planned: {wo.scheduledDate.toLocaleDateString('en-ZA')}</span>
                      </div>
                    </div>
                  ))}
                  {items.length === 0 && (
                    <div className="py-8 text-center">
                      <span className="text-2xl opacity-50 mb-2 block">✅</span>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">No backlog</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function PMDashboard() {
  return (
    <main className="h-screen p-4 md:p-6 lg:p-8 text-slate-900 font-sans flex flex-col overflow-hidden bg-[#f4f6f8]">
      <Suspense fallback={
        <div className="flex-1 flex flex-col items-center justify-center bg-white border border-slate-200 rounded-xl shadow-sm">
           <div className="w-8 h-8 border-4 border-slate-100 border-t-purple-600 rounded-full animate-spin mb-4"></div>
           <div className="text-[10px] font-bold text-slate-400 tracking-widest uppercase">Loading PM Priority Engine...</div>
        </div>
      }>
        <PMPlanLogic />
      </Suspense>
    </main>
  );
}