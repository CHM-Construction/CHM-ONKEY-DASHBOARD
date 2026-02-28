"use client";

import { useRef, useMemo, Suspense } from "react";
import { useQuery } from "@tanstack/react-query";
import { useVirtualizer } from '@tanstack/react-virtual';
import { useQueryState, parseAsString } from 'nuqs';

type Asset = {
  id: number;
  properties: {
    code: string;
    description: string;
    isActive: boolean;
    siteDescription: string;
    parentAssetCode: string | null;
    parentAssetDescription: string | null;
    assetTypeDescription: string | null;
    treePathItems: any[];
  };
};

function AssetLogic() {
  const [searchTerm, setSearchTerm] = useQueryState('search', parseAsString.withDefault('').withOptions({ shallow: true, throttleMs: 300 }));
  const [statusFilter, setStatusFilter] = useQueryState('status', parseAsString.withDefault('Active').withOptions({ shallow: true }));

  // 📡 DATA PIPELINE: Fetching the Plant Asset Register
  const { data: assets = [], isLoading } = useQuery<Asset[]>({
    queryKey: ['assets_raw'],
    queryFn: async () => {
      try {
        const ONKEY_URL = "https://core-za.onkey.app/api/tenants/vkbgroup/prd/Modules/AMPC/RegularAssets/?$top=50000&$skip=0&langId=1000&ct=true";
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
    refetchInterval: 3600000 // Assets don't change often, poll every 1 hour
  });

  // 🧠 MEMORY FILTERING
  const filteredAssets = useMemo(() => {
    return assets.filter(asset => {
      const isActive = asset.properties?.isActive;
      
      // Status Filter
      if (statusFilter === 'Active' && !isActive) return false;
      if (statusFilter === 'Inactive' && isActive) return false;
      
      // Search Filter
      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase();
        const desc = (asset.properties?.description || "").toLowerCase();
        const code = (asset.properties?.code || "").toLowerCase();
        const parent = (asset.properties?.parentAssetDescription || "").toLowerCase();
        
        if (!desc.includes(searchLower) && !code.includes(searchLower) && !parent.includes(searchLower)) {
          return false;
        }
      }
      return true;
    });
  }, [assets, searchTerm, statusFilter]);

  // High-Level Asset KPIs
  const activeCount = assets.filter(a => a.properties.isActive).length;
  const inactiveCount = assets.length - activeCount;

  // 📜 VIRTUALIZER
  const parentRef = useRef<HTMLDivElement>(null);
  const rowVirtualizer = useVirtualizer({
    count: filteredAssets.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 80, // Height of the asset card
    overscan: 10, 
  });

  return (
    <div className="max-w-[1600px] mx-auto w-full flex flex-col h-full shrink-0">
      
      {/* 🎩 PREMIUM HEADER & KPI TOOLBAR */}
      <header className="mb-5 shrink-0 pt-2 space-y-4">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 pb-4 border-b border-slate-200">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900 tracking-tight">Plant Asset Registry</h1>
            <p className="text-sm text-slate-500 mt-1 font-medium">Master database of all equipment and hierarchical structures.</p>
          </div>
          
          <div className="flex gap-4">
             <div className="bg-white px-4 py-2 rounded-lg border border-slate-200 shadow-sm flex flex-col items-center min-w-[100px]">
                <span className="text-xl font-black text-slate-800">{assets.length}</span>
                <span className="text-[9px] font-bold uppercase tracking-widest text-slate-400">Total Assets</span>
             </div>
             <div className="bg-emerald-50 px-4 py-2 rounded-lg border border-emerald-100 shadow-sm flex flex-col items-center min-w-[100px]">
                <span className="text-xl font-black text-emerald-700">{activeCount}</span>
                <span className="text-[9px] font-bold uppercase tracking-widest text-emerald-600">Active</span>
             </div>
             <div className="bg-rose-50 px-4 py-2 rounded-lg border border-rose-100 shadow-sm flex flex-col items-center min-w-[100px]">
                <span className="text-xl font-black text-rose-700">{inactiveCount}</span>
                <span className="text-[9px] font-bold uppercase tracking-widest text-rose-600">Decommissioned</span>
             </div>
          </div>
        </div>

        {/* 🎛️ CONTROLS */}
        <div className="flex flex-col lg:flex-row gap-3 items-center justify-between">
          <div className="relative w-full lg:w-[500px] group">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <svg className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            </div>
            <input 
              type="text" 
              placeholder="Search by asset code, description, or parent line..." 
              className="w-full pl-9 pr-4 py-2 bg-white border border-slate-300 rounded-md text-sm font-medium text-slate-900 placeholder-slate-400 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all shadow-sm"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="flex items-center gap-4 w-full xl:w-auto overflow-x-auto hide-scrollbar">
            <div className="flex bg-slate-200/60 p-1 rounded-md border border-slate-200/50">
              {['All', 'Active', 'Inactive'].map(stat => (
                <button
                  key={stat}
                  onClick={() => setStatusFilter(stat)}
                  className={`px-5 py-1.5 rounded text-[11px] font-bold uppercase tracking-wider transition-all duration-200 ${
                    statusFilter === stat ? "bg-white text-slate-900 shadow-sm border border-slate-200/50" : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  {stat}
                </button>
              ))}
            </div>
          </div>
        </div>
      </header>

      {/* 📊 HIGH-DENSITY ASSET TABLE (Virtual) */}
      <div className="flex-grow bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col overflow-hidden relative">
        <div className="flex px-6 py-3 bg-[#f8fafc] border-b border-slate-200 text-[10px] font-bold uppercase tracking-widest text-slate-500 shrink-0">
          <div className="w-2/12">Asset Code</div>
          <div className="w-4/12">Equipment Description</div>
          <div className="w-3/12">Parent Line / Area</div>
          <div className="w-2/12">Equipment Type</div>
          <div className="w-1/12 text-right">Status</div>
        </div>

        <div ref={parentRef} className="flex-grow overflow-auto relative hide-scrollbar">
          {isLoading ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/80 z-20">
              <div className="w-8 h-8 border-4 border-slate-100 border-t-blue-600 rounded-full animate-spin mb-4"></div>
              <div className="text-[10px] font-bold text-slate-400 tracking-widest uppercase">Downloading Asset DNA...</div>
            </div>
          ) : filteredAssets.length === 0 ? (
            <div className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-slate-400 tracking-widest uppercase">
              No Assets Found
            </div>
          ) : (
            <div style={{ height: `${rowVirtualizer.getTotalSize()}px`, width: '100%', position: 'relative' }}>
              {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                const asset = filteredAssets[virtualRow.index];
                const isActive = asset.properties.isActive;
                
                return (
                  <div
                    key={virtualRow.index}
                    className="absolute top-0 left-0 w-full group border-b border-slate-50 hover:bg-[#f8fafc] transition-colors cursor-pointer"
                    style={{ height: `${virtualRow.size}px`, transform: `translateY(${virtualRow.start}px)` }}
                  >
                    <div className="flex items-center px-6 h-full relative">
                      <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                      
                      {/* Code */}
                      <div className="w-2/12">
                        <span className="font-mono text-[11px] font-bold text-slate-600 group-hover:text-indigo-600 transition-colors">
                          {asset.properties.code}
                        </span>
                      </div>

                      {/* Description */}
                      <div className="w-4/12 pr-4">
                        <p className="text-sm font-semibold text-slate-800 truncate" title={asset.properties.description}>
                          {asset.properties.description || 'N/A'}
                        </p>
                      </div>

                      {/* Parent Hierarchy */}
                      <div className="w-3/12 pr-4">
                         <p className="text-xs font-medium text-slate-500 truncate" title={asset.properties.parentAssetDescription || ''}>
                           {asset.properties.parentAssetDescription ? (
                             <>
                               <span className="text-slate-300 mr-1">↳</span> {asset.properties.parentAssetDescription}
                             </>
                           ) : (
                             <span className="text-slate-300 italic">Top Level Asset</span>
                           )}
                         </p>
                         <p className="text-[9px] font-mono text-slate-400 mt-0.5">{asset.properties.parentAssetCode}</p>
                      </div>

                      {/* Type */}
                      <div className="w-2/12">
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider bg-white border border-slate-200 px-2 py-0.5 rounded shadow-sm truncate block w-max max-w-full">
                          {asset.properties.assetTypeDescription || 'Unknown'}
                        </span>
                      </div>

                      {/* Status */}
                      <div className="w-1/12 flex justify-end">
                        <span className={`inline-flex items-center px-2 py-1 rounded text-[9px] font-bold uppercase tracking-widest ring-1 ring-inset ${
                          isActive ? 'ring-emerald-600/20 bg-emerald-50 text-emerald-700' : 'ring-rose-600/20 bg-rose-50 text-rose-700'
                        }`}>
                          {isActive ? 'ACTIVE' : 'INACTIVE'}
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

export default function AssetDashboard() {
  return (
    <main className="h-screen p-4 md:p-8 text-slate-900 font-sans flex flex-col overflow-hidden">
      <Suspense fallback={
        <div className="flex-1 flex flex-col items-center justify-center bg-white border border-slate-200 rounded-xl shadow-sm">
           <div className="w-8 h-8 border-4 border-slate-100 border-t-[#0f172a] rounded-full animate-spin mb-4"></div>
           <div className="text-[10px] font-bold text-slate-400 tracking-widest uppercase">Loading Registry...</div>
        </div>
      }>
        <AssetLogic />
      </Suspense>
    </main>
  );
}