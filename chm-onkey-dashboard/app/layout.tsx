import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Providers from "./providers";
import Link from "next/link";
import { NuqsAdapter } from 'nuqs/adapters/next/app'; 

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "VKB Maintenance Intelligence",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.className} flex h-screen bg-[#f4f6f8] overflow-hidden text-slate-800`}>
        <NuqsAdapter>
          <Providers>
            
            {/* 🏢 ENTERPRISE SIDEBAR NAVIGATION */}
            <nav className="w-64 shrink-0 bg-[#0f172a] text-slate-300 flex flex-col z-50 hidden md:flex border-r border-slate-800">
              
              {/* Brand Logo Area */}
              <div className="h-16 flex items-center px-6 border-b border-slate-800/60 bg-[#0B1120]/50">
                <div className="flex items-center gap-3">
                  <div className="w-7 h-7 bg-blue-600 rounded flex items-center justify-center shadow-inner">
                    <span className="text-white font-bold text-[10px] tracking-widest">VKB</span>
                  </div>
                  <div>
                    <h1 className="text-xs font-bold tracking-widest text-slate-100 uppercase leading-tight">VKB Group</h1>
                    <p className="text-[9px] font-semibold text-slate-500 uppercase tracking-widest">Christiana Mill</p>
                  </div>
                </div>
              </div>
              
              {/* Navigation Links */}
              <div className="flex flex-col py-6 px-4 space-y-1.5 flex-grow">
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-3 mb-2">Applications</p>
                
                <Link href="/" className="px-3 py-2.5 rounded-md hover:bg-slate-800/50 transition-colors text-sm font-medium flex items-center gap-3 hover:text-white group">
                  <svg className="w-4 h-4 text-slate-400 group-hover:text-blue-400 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>
                  Field Terminal
                </Link>
                
                <Link href="/overview" className="px-3 py-2.5 rounded-md hover:bg-slate-800/50 transition-colors text-sm font-medium flex items-center gap-3 hover:text-white group">
                  <svg className="w-4 h-4 text-slate-400 group-hover:text-emerald-400 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
                  Exec Overview
                </Link>

                <Link href="/report" className="px-3 py-2.5 rounded-md hover:bg-slate-800/50 transition-colors text-sm font-medium flex items-center gap-3 hover:text-white group">
                  <svg className="w-4 h-4 text-slate-400 group-hover:text-amber-400 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                  Auto-Report
                </Link>

                <Link href="/pm-plan" className="px-3 py-2.5 rounded-md hover:bg-slate-800/50 transition-colors text-sm font-medium flex items-center gap-3 hover:text-white group">
                  <svg className="w-4 h-4 text-slate-400 group-hover:text-purple-400 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                  PM Schedule
                </Link>

                <Link href="/assets" className="px-3 py-2.5 rounded-md hover:bg-slate-800/50 transition-colors text-sm font-medium flex items-center gap-3 hover:text-white group">
                  <svg className="w-4 h-4 text-slate-400 group-hover:text-indigo-400 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 002-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
                  Asset Registry
                </Link>
              </div>

              {/* 👑 EXECUTIVE USER PROFILE FOOTER */}
              <div className="p-4 border-t border-slate-800/60 bg-[#0B1120]/30">
                <div className="flex items-center gap-3 px-2">
                  <div className="w-8 h-8 rounded-md bg-gradient-to-br from-emerald-500 to-teal-600 text-white flex items-center justify-center font-bold text-xs shadow-sm ring-1 ring-emerald-500/50">
                    MM
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-200 leading-tight">Maintenance Manager</p>
                    <p className="text-[10px] text-emerald-500 uppercase tracking-widest font-bold mt-0.5">GMR 2.1 Appointee</p>
                  </div>
                </div>
              </div>
            </nav>

            {/* MAIN CONTENT AREA */}
            <main className="flex-1 overflow-y-auto w-full relative">
              {children}
            </main>

          </Providers>
        </NuqsAdapter>
      </body>
    </html>
  );
}