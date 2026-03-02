"use client";

import { useRef, useMemo, useState, Suspense } from "react";
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
    treePathItems: { sequence: number, code: string, description: string }[];
  };
};

function AssetLogic() {
  const [searchTerm, setSearchTerm] = useQueryState('search', parseAsString.withDefault('').withOptions({ shallow: true, throttleMs: 300 }));
  
  // 🌳 NEW: Tree Navigation State
  const [selectedNode, setSelectedNode] = useQueryState('node', parseAsString.withDefault('ALL').withOptions({ shallow: true }));
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});

  // 📡 DATA PIPELINE
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
    refetchInterval: 3600000 // 1 hour
  });

  // 🌳 AUTO-BUILD THE PLANT HIERARCHY TREE
  const plantTree = useMemo(() => {
    const tree: Record<string, { name: string, code: string, areas: Record<string, { name: string, code: string }> }> = {};
    
    assets.forEach(asset => {
      const path = asset.properties.treePathItems || [];
      // In OnKey, Seq 4 is usually the Section (e.g. Tertiary), Seq 5 is Area (e.g. Packaging)
      const section = path.find(p => p.sequence === 4);
      const area = path.find(p => p.sequence === 5);

      if (section) {
        if (!tree[section.code]) {
          tree[section.code] = { name: section.description, code: section.code, areas: {} };
        }
        if (area && !tree[section.code].areas[area.code]) {
          tree[section.code].areas[area.code] = { name: area.description, code: area.code };
        }
      }
    });
    return tree;
  }, [assets]);

  const toggleSection = (code: string) => {
    setExpandedSections(prev => ({ ...prev, [code]: !prev[code] }));
  };

  // 🧠 MEMORY FILTERING (Now heavily influenced by the clicked folder)
  const filteredAssets = useMemo(() => {
    return assets.filter(asset => {
      // 1. Tree Filter
      if (selectedNode !== 'ALL') {
        const pathCodes = asset.properties.treePathItems?.map(p => p.code) || [];
        if (!pathCodes.includes(selectedNode)) return false;
      }
      
      // 2. Text Search Filter
      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase();
        const desc = (asset.properties?.description || "").toLowerCase();
        const code = (asset.properties?.code || "").toLowerCase();
        if (!desc.includes(searchLower) && !code.includes(searchLower)) return false;
      }
      return true;
    });
  }, [assets, searchTerm, selectedNode]);

  // 📜 VIRTUALIZER
  const parentRef = useRef<HTMLDivElement>(null);
  const rowVirtualizer = useVirtualizer({
    count: filteredAssets.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 80, 
    overscan: 10, 
  });

  // Helper to find the name of the currently selected folder
  const currentFolderName = selectedNode === 'ALL' ? 'Entire Plant' : 
    assets.find(a => a.properties.treePathItems?.some(p => p.code === selectedNode))
    ?.properties.treePathItems.find(p => p.code === selectedNode)?.description || 'Selected Area';

  return (
    <div className="max-w-[1800px] mx-auto w-full flex flex-col h-full shrink-0">
      
      {/* HEADER */}
      <header className="mb-4 shrink-0 pt-2 pb-4 border-b border-slate-200 flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 tracking-tight">Plant Explorer</h1>
          <p className="text-sm text-slate-500 mt-1 font-medium">Browse Christiana Mill by section and floor.</p>
        </div>
        <div className="hidden md:flex items-center gap-2 bg-white px-4 py-2 rounded-lg border border-slate-200 shadow-sm">
           <span className="text-xl font-black text-slate-800">{assets.length}</span>
           <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Total Assets</span>
        </div>
      </header>

      {/* DUAL PANE LAYOUT */}
      <div className="flex flex-col lg:flex-row gap-6 flex-grow overflow-hidden pb-6">
        
        {/* 🌳 LEFT PANE: THE FOLDER NAVIGATOR */}
        <div className="w-full lg:w-80 bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col overflow-hidden shrink-0">
          <div className="p-4 border-b border-slate-100 bg-[#f8fafc]">
            <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Plant Hierarchy</h3>
          </div>
          <div className="overflow-y-auto p-3 flex-grow hide-scrollbar space-y-1">
            
            {/* Root "All Assets" Node */}
            <button 
              onClick={() => setSelectedNode('ALL')}
              className={`w-full text-left px-3 py-2 rounded-md text-sm font-semibold flex items-center gap-3 transition-colors ${
                selectedNode === 'ALL' ? 'bg-blue-50 text-blue-700' : 'text-slate-700 hover:bg-slate-50'
              }`}
            >
              <span>🏢</span> All Plant Assets
            </button>

            {/* Dynamically Generated Sections & Areas */}
            {Object.values(plantTree).map(section => (
              <div key={section.code} className="pt-1">
                <div className="flex items-center">
                  <button onClick={() => toggleSection(section.code)} className="p-1 text-slate-400 hover:text-slate-800">
                    <svg className={`w-4 h-4 transition-transform ${expandedSections[section.code] ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                  </button>
                  <button 
                    onClick={() => setSelectedNode(section.code)}
                    className={`flex-grow text-left px-2 py-1.5 rounded-md text-sm font-semibold flex items-center gap-2 transition-colors truncate ${
                      selectedNode === section.code ? 'bg-blue-50 text-blue-700' : 'text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <span>📁</span> {section.name}
                  </button>
                </div>
                
                {/* Sub-Areas (Floors/Lines) - Only show if parent is expanded */}
                {expandedSections[section.code] && (
                  <div className="pl-8 pr-2 mt-1 space-y-1 border-l-2 border-slate-100 ml-3">
                    {Object.values(section.areas).map(area => (
                      <button 
                        key={area.code}
                        onClick={() => setSelectedNode(area.code)}
                        className={`w-full text-left px-3 py-1.5 rounded-md text-xs font-medium flex items-center gap-2 transition-colors truncate ${
                          selectedNode === area.code ? 'bg-blue-50 text-blue-700 font-bold' : 'text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        <span className="text-slate-300">↳</span> {area.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* 🗂️ RIGHT PANE: THE ASSET VIEWPORT */}
        <div className="flex-grow bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col overflow-hidden relative">
          
          {/* Viewport Toolbar */}
          <div className="p-4 border-b border-slate-100 bg-[#f8fafc] flex flex-col md:flex-row justify-between items-center gap-4 shrink-0">
            <div className="flex items-center gap-2">
              <span className="text-2xl">📂</span>
              <div>
                <h2 className="text-sm font-bold text-slate-800">{currentFolderName}</h2>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">{filteredAssets.length} items</p>
              </div>
            </div>
            
            <div className="relative w-full md:w-72">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <svg className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
              </div>
              <input 
                type="text" 
                placeholder="Search within folder..." 
                className="w-full pl-9 pr-3 py-1.5 bg-white border border-slate-300 rounded text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all outline-none"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>

          {/* Table Headers */}
          <div className="flex px-6 py-2 bg-white border-b border-slate-200 text-[10px] font-bold uppercase tracking-widest text-slate-400 shrink-0">
            <div className="w-2/12">Code</div>
            <div className="w-5/12">Equipment Description</div>
            <div className="w-3/12">Type</div>
            <div className="w-2/12 text-right">Status</div>
          </div>

          {/* Virtualized List */}
          <div ref={parentRef} className="flex-grow overflow-auto relative hide-scrollbar bg-slate-50">
            {isLoading ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/80 z-20">
                <div className="w-8 h-8 border-4 border-slate-100 border-t-blue-600 rounded-full animate-spin mb-4"></div>
                <div className="text-[10px] font-bold text-slate-400 tracking-widest uppercase">Building Explorer...</div>
              </div>
            ) : filteredAssets.length === 0 ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                 <span className="text-4xl mb-3">📭</span>
                 <div className="text-[10px] font-bold text-slate-400 tracking-widest uppercase">Folder is Empty</div>
              </div>
            ) : (
              <div style={{ height: `${rowVirtualizer.getTotalSize()}px`, width: '100%', position: 'relative' }}>
                {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                  const asset = filteredAssets[virtualRow.index];
                  const isActive = asset.properties.isActive;
                  
                  return (
                    <div
                      key={virtualRow.index}
                      className="absolute top-0 left-0 w-full group border-b border-slate-100 bg-white hover:bg-blue-50/30 transition-colors cursor-pointer"
                      style={{ height: `${virtualRow.size}px`, transform: `translateY(${virtualRow.start}px)` }}
                    >
                      <div className="flex items-center px-6 h-full relative">
                        <div className="w-2/12 font-mono text-[11px] font-bold text-slate-500 group-hover:text-blue-600 transition-colors">
                          {asset.properties.code}
                        </div>
                        <div className="w-5/12 pr-4">
                          <p className="text-xs font-semibold text-slate-800 truncate" title={asset.properties.description}>
                            {asset.properties.description || 'N/A'}
                          </p>
                        </div>
                        <div className="w-3/12 pr-2">
                          <p className="text-[10px] font-medium text-slate-500 truncate">
                             {asset.properties.assetTypeDescription || 'Unknown'}
                          </p>
                        </div>
                        <div className="w-2/12 flex justify-end">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-widest ring-1 ring-inset ${
                            isActive ? 'ring-emerald-600/20 bg-emerald-50 text-emerald-700' : 'ring-rose-600/20 bg-rose-50 text-rose-700'
                          }`}>
                            {isActive ? 'ACTIVE' : 'OFFLINE'}
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
    </div>
  );
}

export default function AssetDashboard() {
  return (
    <main className="h-screen p-4 md:p-6 lg:p-8 text-slate-900 font-sans flex flex-col overflow-hidden">
      <Suspense fallback={
        <div className="flex-1 flex flex-col items-center justify-center bg-white border border-slate-200 rounded-xl shadow-sm">
           <div className="w-8 h-8 border-4 border-slate-100 border-t-[#0f172a] rounded-full animate-spin mb-4"></div>
           <div className="text-[10px] font-bold text-slate-400 tracking-widest uppercase">Loading Explorer...</div>
        </div>
      }>
        <AssetLogic />
      </Suspense>
    </main>
  );
}