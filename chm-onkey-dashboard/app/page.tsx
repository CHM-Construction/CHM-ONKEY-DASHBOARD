"use client";

import { useRef, useMemo, Suspense } from "react";
import { useQuery } from "@tanstack/react-query";
import { useVirtualizer } from '@tanstack/react-virtual';
import { useQueryState, parseAsString } from 'nuqs'; 

type WorkOrder = {
  id: number;
  properties: {
    code: string;
    assetCode: string;
    assetDescription: string;
    statusDescription: string;
    typeOfWorkDescription: string;
    workRequired?: string;
    createdOn: string;
    workStartedOn: string | null;
    startOn: string | null;
    completedOn: string | null;
  };
};

function TerminalLogic() {
  const [searchTerm, setSearchTerm] = useQueryState('search', parseAsString.withDefault('').withOptions({ shallow: true, throttleMs: 300 }));
  const [statusFilter, setStatusFilter] = useQueryState('status', parseAsString.withDefault('All').withOptions({ shallow: true }));

  // 📡 SAFE DATA PIPELINE
  const { data: workOrders = [], isLoading } = useQuery<WorkOrder[]>({
    queryKey: ['workorders_raw'],
    queryFn: async () => {
      try {
        const ONKEY_URL = "https://core-za.onkey.app/api/tenants/vkbgroup/prd/Modules/WM/WorkOrders/?$top=5000&cid=1750243656100004&ct=true";
        const ONKEY_TOKEN = process.env.NEXT_PUBLIC_ONKEY_API_TOKEN || "";

        const res = await fetch(ONKEY_URL, {
          headers: { 'Authorization': ONKEY_TOKEN, 'Accept': 'application/json' }
        });
        
        if (!res.ok) return []; 
        const data = await res.json();
        return data?.items || [];
      } catch (error) {
        return []; 
      }
    },
    refetchInterval: 300000 
  });

  const filteredOrders = useMemo(() => {
    return workOrders.filter(wo => {
      const status = wo.properties?.statusDescription || "";
      if (status.toLowerCase() === 'request to cancel') return false;
      if (statusFilter !== 'All' && status !== statusFilter) return false;
      
      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase();
        const assetDesc = (wo.properties?.assetDescription || "").toLowerCase();
        const code = (wo.properties?.code || "").toLowerCase();
        if (!assetDesc.includes(searchLower) && !code.includes(searchLower)) return false;
      }
      return true;
    });
  }, [workOrders, searchTerm, statusFilter]);

  const parentRef = useRef<HTMLDivElement>(null);
  
  // 📏 Sleeker, compact rows for enterprise high-density scanning
  const rowVirtualizer = useVirtualizer({
    count: filteredOrders.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 64, 
    overscan: 10, 
  });

  // 🎨 Enterprise Status Color Mapping (Soft backgrounds with ring borders)
  const getStatusStyle = (status: string) => {
    switch(status) {
      case 'Completed': return 'bg-emerald-50 text-emerald-700 ring-emerald-600/20';
      case 'Started': return 'bg-blue-50 text-blue-700 ring-blue-600/20';
      case 'Approved': return 'bg-purple-50 text-purple-700 ring-purple-600/20';
      default: return 'bg-slate-50 text-slate-600 ring-slate-500/20';
    }
  };

  const getStatusDot = (status: string) => {
    switch(status) {
      case 'Completed': return 'bg-emerald-500';
      case 'Started': return 'bg-blue-500';
      case 'Approved': return 'bg-purple-500';
      default: return 'bg-slate-300';
    }
  };

  return (
    <div className="max-w-[1600px] mx-auto w-full flex flex-col h-full shrink-0">
      
      {/* 🎩 PREMIUM HEADER & TOOLBAR */}
      <header className="mb-5 shrink-0 pt-2 space-y-4">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 pb-4 border-b border-slate-200">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900 tracking-tight">Active Work Terminal</h1>
            <p className="text-sm text-slate-500 mt-1 font-medium">Real-time work order tracking and execution grid.</p>
          </div>
          <div className="hidden md:flex items-center gap-3">
             <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-md border border-slate-200 shadow-sm">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <span className="text-[10px] font-bold uppercase text-slate-600 tracking-widest">Live Syncing</span>
             </div>
          </div>
        </div>

        {/* 🎛️ CONTROLS: Mac-style Search & Segmented Filter */}
        <div className="flex flex-col lg:flex-row gap-3 items-center justify-between">
          
          <div className="relative w-full lg:w-[400px] group">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <svg className="h-4 w-4 text-slate-400 group-focus-within:text-blue-500 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            </div>
            <input 
              type="text" 
              placeholder="Search assets, codes, or descriptions..." 
              className="w-full pl-9 pr-4 py-2 bg-white border border-slate-300 rounded-md text-sm font-medium text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all shadow-sm"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="flex items-center gap-4 w-full xl:w-auto overflow-x-auto hide-scrollbar">
            <div className="flex bg-slate-200/60 p-1 rounded-md border border-slate-200/50">
              {['All', 'Approved', 'Started', 'Completed'].map(stat => (
                <button
                  key={stat}
                  onClick={() => setStatusFilter(stat)}
                  className={`px-5 py-1.5 rounded text-[11px] font-bold uppercase tracking-wider transition-all duration-200 whitespace-nowrap ${
                    statusFilter === stat 
                      ? "bg-white text-slate-900 shadow-sm border border-slate-200/50" 
                      : "text-slate-500 hover:text-slate-800 hover:bg-slate-200/50"
                  }`}
                >
                  {stat}
                </button>
              ))}
            </div>
            
            <div className="hidden md:flex items-center px-4 py-1 border-l border-slate-200">
              <p className="text-[10px] uppercase font-bold text-slate-400 tracking-widest">
                <span className="text-slate-700">{filteredOrders.length}</span> Records
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* 📊 HIGH-DENSITY DATA TABLE (Virtual) */}
      <div className="flex-grow bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col overflow-hidden relative">
        
        {/* Fixed Header Row for column alignment */}
        <div className="flex px-6 py-3 bg-[#f8fafc] border-b border-slate-200 text-[10px] font-bold uppercase tracking-widest text-slate-500 shrink-0">
          <div className="w-2/12">Ticket</div>
          <div className="w-5/12">Asset Details</div>
          <div className="w-2/12">Work Type</div>
          <div className="w-1/12">Logged</div>
          <div className="w-2/12 text-right">Status</div>
        </div>

        {/* Scrollable Virtual Body */}
        <div ref={parentRef} className="flex-grow overflow-auto relative hide-scrollbar">
          {isLoading ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/80 z-20">
              <div className="w-8 h-8 border-4 border-slate-100 border-t-blue-600 rounded-full animate-spin mb-4"></div>
              <div className="text-[10px] font-bold text-slate-400 tracking-widest uppercase">Fetching Records...</div>
            </div>
          ) : filteredOrders.length === 0 ? (
            <div className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-slate-400 tracking-widest uppercase">
              No Work Orders Found
            </div>
          ) : (
            <div style={{ height: `${rowVirtualizer.getTotalSize()}px`, width: '100%', position: 'relative' }}>
              {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                const wo = filteredOrders[virtualRow.index];
                const status = wo?.properties?.statusDescription || 'Unknown';
                
                return (
                  <div
                    key={virtualRow.index}
                    className="absolute top-0 left-0 w-full group border-b border-slate-50 hover:bg-[#f8fafc] transition-colors cursor-pointer"
                    style={{ height: `${virtualRow.size}px`, transform: `translateY(${virtualRow.start}px)` }}
                  >
                    <div className="flex items-center px-6 h-full relative">
                      
                      {/* Left Hover Accent Indicator */}
                      <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-blue-500 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                      
                      {/* Ticket */}
                      <div className="w-2/12 flex items-center gap-3">
                        <span className={`w-1.5 h-1.5 rounded-full ${getStatusDot(status)}`}></span>
                        <span className="font-mono text-[11px] font-semibold text-slate-600 group-hover:text-blue-600 transition-colors">
                          {wo?.properties?.code}
                        </span>
                      </div>

                      {/* Asset Details */}
                      <div className="w-5/12 pr-4">
                        <p className="text-sm font-semibold text-slate-800 truncate" title={wo?.properties?.assetDescription}>
                          {wo?.properties?.assetDescription || 'Unknown Asset'}
                        </p>
                        <p className="text-[10px] font-mono text-slate-400 truncate mt-0.5">{wo?.properties?.assetCode}</p>
                      </div>

                      {/* Work Type */}
                      <div className="w-2/12">
                         <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider bg-white border border-slate-200 px-2 py-0.5 rounded shadow-sm">
                           {wo?.properties?.typeOfWorkDescription || 'N/A'}
                         </span>
                      </div>

                      {/* Logged Date */}
                      <div className="w-1/12 text-xs font-medium text-slate-600">
                        {wo?.properties?.createdOn ? new Date(wo.properties.createdOn).toLocaleDateString('en-ZA', { month: 'short', day: 'numeric' }) : '-'}
                      </div>

                      {/* Status Badge */}
                      <div className="w-2/12 flex justify-end">
                         <span className={`inline-flex items-center px-2 py-1 rounded text-[9px] font-bold uppercase tracking-widest ring-1 ring-inset ${getStatusStyle(status)}`}>
                          {status}
                        </span>
                      </div>

                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// 🛡️ The Main Export
export default function TerminalDashboard() {
  return (
    <main className="h-screen p-4 md:p-8 text-slate-900 font-sans flex flex-col overflow-hidden">
      <Suspense fallback={
        <div className="flex-1 flex flex-col items-center justify-center bg-white border border-slate-200 rounded-xl shadow-sm">
           <div className="w-8 h-8 border-4 border-slate-100 border-t-[#0f172a] rounded-full animate-spin mb-4"></div>
           <div className="text-[10px] font-bold text-slate-400 tracking-widest uppercase">Initializing Terminal...</div>
        </div>
      }>
        <TerminalLogic />
      </Suspense>
    </main>
  );
}