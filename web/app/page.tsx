"use client";

import React, { useState, useEffect } from 'react';
import { 
  Brain, 
  Sparkles, 
  Play, 
  Plus, 
  MapPin, 
  Briefcase, 
  RefreshCw,
  ChevronRight,
  Search,
  Cpu,
  Mail,
  Github,
  Linkedin,
  FileText,
  BarChart3,
  TrendingUp,
  X,
  Settings2,
  Globe,
  LayoutDashboard,
  Menu
} from 'lucide-react';

// --- MOCK DATA FOR ANALYTICS (As requested by user) ---
const pipelineStats = [
  { label: 'Discovered', count: 145, color: 'bg-blue-500', width: '100%' },
  { label: 'Tailoring', count: 24, color: 'bg-violet-500', width: '25%' },
  { label: 'Applied', count: 12, color: 'bg-emerald-500', width: '15%' },
  { label: 'Interviewing', count: 3, color: 'bg-fuchsia-500', width: '5%' },
];

const trendData = [12, 18, 25, 14, 32, 45, 38];
const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export default function App() {
  const [searchProfiles, setSearchProfiles] = useState<any[]>([]);
  const [jobs, setJobs] = useState<any[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('dashboard');
  
  // CV Analysis State
  const [cvText, setCvText] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<any>(null);

  const [newProfile, setNewProfile] = useState({ 
    name: '', 
    keywords: '', 
    location: '', 
    remote: true, 
    platforms: { linkedin: true, indeed: true, glassdoor: false },
    jobTypes: { fulltime: true, parttime: false, contract: false, internship: false },
    hoursOld: 24,
    country: 'USA',
    easyApply: false,
    deepScrape: true,
    resultsWanted: 10
  });

  useEffect(() => {
    fetchLatestCv();
    fetchProfiles();
    fetchJobs();
  }, []);

  const fetchLatestCv = async () => {
    try {
      const res = await fetch("/api/cv/latest");
      if (res.ok) {
        const data = await res.json();
        if (data.cvText) setCvText(data.cvText);
        if (data.analysisResult) setAnalysisResult(data.analysisResult);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchProfiles = async () => {
    try {
      const res = await fetch("/api/profiles");
      if (res.ok) {
        const data = await res.json();
        setSearchProfiles(data.map((p: any) => ({ ...p, isScraping: false })));
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchJobs = async () => {
    try {
      const res = await fetch("/api/jobs");
      if (res.ok) setJobs(await res.json());
    } catch (e) {
      console.error(e);
    }
  };

  const handleAnalyzeCv = async () => {
    if (!cvText) return;
    setIsAnalyzing(true);
    try {
      const res = await fetch("/api/cv/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cvText })
      });
      if (res.ok) {
        const data = await res.json();
        setAnalysisResult(data);
      } else {
        alert("Failed to analyze CV");
      }
    } catch (e) {
      console.error(e);
      alert("Error analyzing CV");
    }
    setIsAnalyzing(false);
  };

  const handleAddProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProfile.name) return;
    
    // Combine name and keywords into a single search term for legacy support
    const searchTerm = newProfile.keywords ? `${newProfile.name} ${newProfile.keywords}`.trim() : newProfile.name;
    
    // Convert platforms object into array of strings
    const platforms = Object.entries(newProfile.platforms)
      .filter(([_, isActive]) => isActive)
      .map(([platform]) => platform);

    const jobTypes = Object.entries(newProfile.jobTypes)
      .filter(([_, isActive]) => isActive)
      .map(([type]) => type);

    try {
      const res = await fetch("/api/profiles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          searchTerm,
          location: newProfile.remote ? 'Remote' : newProfile.location,
          remote: newProfile.remote,
          platforms,
          jobTypes,
          hoursOld: Number(newProfile.hoursOld),
          country: newProfile.country || null,
          easyApply: newProfile.easyApply,
          deepScrape: newProfile.deepScrape,
          resultsWanted: Number(newProfile.resultsWanted)
        }),
      });
      if (res.ok) {
        fetchProfiles();
        setIsModalOpen(false);
        setNewProfile({ 
          name: '', keywords: '', location: '', remote: true, 
          platforms: { linkedin: true, indeed: true, glassdoor: false },
          jobTypes: { fulltime: true, parttime: false, contract: false, internship: false },
          hoursOld: 24, country: 'USA', easyApply: false, deepScrape: true, resultsWanted: 10
        });
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleAddSuggestedProfile = async (suggestion: any) => {
    try {
      const res = await fetch("/api/profiles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          searchTerm: suggestion.searchTerm,
          location: suggestion.location,
          remote: suggestion.location.toLowerCase().includes('remote')
        }),
      });
      if (res.ok) {
        alert(`Added profile: ${suggestion.searchTerm}`);
        fetchProfiles();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleScrape = async (id: string) => {
    // Optimistic UI update
    setSearchProfiles(profiles => 
      profiles.map(p => p.id === id ? { ...p, isScraping: true } : p)
    );
    
    try {
      await fetch("/api/profiles/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profileId: id })
      });
      // Poll or fetch after delay
      setTimeout(() => fetchProfiles(), 1000);
    } catch (e) {
      console.error(e);
    }
    
    setSearchProfiles(profiles => 
      profiles.map(p => p.id === id ? { ...p, isScraping: false } : p)
    );
  };

  const handleStatusChange = async (id: string) => {
    // Optimistic UI update
    setJobs(currentJobs => 
      currentJobs.map(job => {
        if (job.id === id && job.status === "DISCOVERED") {
          return { ...job, status: "TAILORING" };
        }
        return job;
      })
    );
  };

  return (
    <div className="flex h-screen bg-[#0B0F19] text-slate-200 font-sans selection:bg-violet-500/30 overflow-hidden">
      
      {/* LEFT SIDEBAR NAVIGATION */}
      <aside className="w-64 hidden md:flex flex-col border-r border-slate-800/60 bg-[#0B0F19] z-20 shadow-xl shadow-black/50">
        <div className="h-16 flex items-center px-6 border-b border-slate-800/60 gap-3 shrink-0">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-600 to-fuchsia-600 flex items-center justify-center shadow-lg shadow-violet-500/20">
            <Cpu className="w-5 h-5 text-white" />
          </div>
          <span className="font-bold text-lg text-white tracking-wide">Orchestrator</span>
        </div>

        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-3 px-3 mt-2">Workspace</div>
          <button 
            onClick={() => setActiveTab('dashboard')} 
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${activeTab === 'dashboard' ? 'bg-violet-500/10 text-violet-400' : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'}`}
          >
            <LayoutDashboard className="w-4 h-4" /> Dashboard
          </button>
          <button 
            onClick={() => setActiveTab('jobs')} 
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${activeTab === 'jobs' ? 'bg-violet-500/10 text-violet-400' : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'}`}
          >
            <Briefcase className="w-4 h-4" /> Job Pipeline
          </button>
          <button 
            onClick={() => setActiveTab('intelligence')} 
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${activeTab === 'intelligence' ? 'bg-violet-500/10 text-violet-400' : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'}`}
          >
            <Brain className="w-4 h-4" /> CV Intelligence
          </button>
        </nav>

        <div className="p-4 border-t border-slate-800/60 shrink-0">
           <div className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-slate-800/50 cursor-pointer transition-colors">
             <div className="h-8 w-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-xs font-bold text-white">ZH</div>
             <div className="flex flex-col">
               <span className="text-sm font-medium text-slate-200">Zubair Haider</span>
               <span className="text-[10px] text-slate-500 truncate max-w-[130px]">zubairhaider0906@gmail.com</span>
             </div>
           </div>
        </div>
      </aside>

      {/* MAIN CONTENT WRAPPER */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        
        {/* Top Header */}
        <header className="h-16 flex items-center justify-between px-4 sm:px-6 border-b border-slate-800/60 bg-[#0B0F19]/80 backdrop-blur-xl shrink-0">
          <div className="flex items-center gap-3 md:hidden">
            <Menu className="w-5 h-5 text-slate-400" />
            <span className="font-bold text-white">Orchestrator</span>
          </div>
          <div className="hidden md:flex items-center gap-2">
             <h2 className="text-lg font-bold text-white capitalize">{activeTab.replace('-', ' ')}</h2>
          </div>
          <div className="flex items-center gap-4 text-sm font-medium">
            <span className="inline-flex items-center gap-2 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20 text-emerald-400 text-xs font-bold shadow-[0_0_15px_rgba(16,185,129,0.1)]">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
              Postgres Active
            </span>
          </div>
        </header>

        {/* Scrollable Content Area */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-300">
            
            {/* TAB: DASHBOARD */}
            {activeTab === 'dashboard' && (
              <>
                {/* Analytics Dashboard */}
                <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Card 1: Pipeline Funnel */}
                  <div className="bg-[#131B2B] rounded-xl border border-slate-800/80 p-5 shadow-lg shadow-black/20">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <BarChart3 className="w-4 h-4 text-emerald-400" />
                        <h3 className="text-sm font-bold text-white tracking-wide">Application Pipeline</h3>
                      </div>
                      <span className="text-[10px] uppercase font-bold text-slate-500 bg-slate-800/50 px-2 py-1 rounded border border-slate-700/50">All Time</span>
                    </div>
                    <div className="space-y-3.5">
                      {pipelineStats.map((stat, i) => (
                        <div key={i} className="space-y-1.5">
                          <div className="flex justify-between text-xs font-medium">
                            <span className="text-slate-400">{stat.label}</span>
                            <span className="text-slate-200">{stat.count}</span>
                          </div>
                          <div className="w-full bg-slate-900/80 rounded-full h-1.5 overflow-hidden">
                            <div className={`h-full rounded-full ${stat.color} shadow-[0_0_10px_rgba(0,0,0,0.5)]`} style={{ width: stat.width }}></div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Card 2: Discovery Trend */}
                  <div className="bg-[#131B2B] rounded-xl border border-slate-800/80 p-5 shadow-lg shadow-black/20 flex flex-col">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <TrendingUp className="w-4 h-4 text-violet-400" />
                        <h3 className="text-sm font-bold text-white tracking-wide">Discovery Trend</h3>
                      </div>
                      <span className="text-[10px] uppercase font-bold text-slate-500 bg-slate-800/50 px-2 py-1 rounded border border-slate-700/50">Last 7 Days</span>
                    </div>
                    <div className="flex-1 flex items-end justify-between gap-2 relative h-28 pt-6">
                      {trendData.map((val, i, arr) => {
                        const max = Math.max(...arr);
                        const height = `${(val / max) * 100}%`;
                        return (
                          <div key={i} className="w-full h-full flex flex-col justify-end group relative cursor-crosshair">
                            <div className="absolute -top-7 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10 border border-slate-700 shadow-xl">
                              {val} jobs
                            </div>
                            <div 
                              className="w-full bg-gradient-to-t from-violet-600/20 to-violet-500/40 hover:from-violet-500/50 hover:to-violet-400/70 border-t-2 border-violet-400 rounded-t-sm transition-all duration-300"
                              style={{ height }}
                            ></div>
                          </div>
                        );
                      })}
                    </div>
                    <div className="flex justify-between text-[10px] text-slate-500 mt-3 font-medium px-1 border-t border-slate-800/60 pt-2">
                      {days.map((day, i) => <span key={i}>{day}</span>)}
                    </div>
                  </div>
                </section>

                {/* Active Search Profiles */}
                <section>
                  <div className="flex items-center justify-between mb-6 mt-8">
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                      <Search className="w-5 h-5 text-violet-500" />
                      Active Search Profiles
                    </h2>
                    <button 
                      onClick={() => setIsModalOpen(true)}
                      className="text-sm font-medium text-violet-400 hover:text-violet-300 transition-colors flex items-center gap-1"
                    >
                      <Plus className="w-4 h-4" /> New Profile
                    </button>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {searchProfiles.map((profile) => (
                      <div key={profile.id} className="bg-[#131B2B] rounded-xl border border-slate-800/80 p-5 hover:border-slate-700 transition-all shadow-lg shadow-black/20 relative overflow-hidden group">
                        {profile.isScraping && (
                          <div className="absolute top-0 left-0 w-full h-1 bg-slate-800 overflow-hidden">
                            <div className="h-full bg-violet-500 animate-[pulse_1.5s_ease-in-out_infinite] w-1/2 rounded-r-full"></div>
                          </div>
                        )}
                        
                        <div className="flex justify-between items-start mb-6">
                          <div>
                            <h3 className="text-lg font-bold text-slate-100">{profile.searchTerm}</h3>
                            <div className="text-xs text-slate-500 flex items-center gap-1 mt-1 uppercase tracking-wide">
                              <MapPin className="w-3 h-3" /> {profile.location} {profile.remote && "(Remote)"}
                            </div>
                            <div className="flex flex-wrap gap-2 mt-3">
                              {profile.jobTypes?.map((type: string) => (
                                <span key={type} className="px-2 py-1 bg-slate-800/50 border border-slate-700/50 rounded text-[10px] text-slate-400 capitalize">{type}</span>
                              ))}
                              {profile.platforms?.map((plat: string) => (
                                <span key={plat} className="px-2 py-1 bg-blue-500/10 border border-blue-500/20 rounded text-[10px] text-blue-400 capitalize">{plat}</span>
                              ))}
                              {profile.easyApply && <span className="px-2 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded text-[10px] text-emerald-400 font-medium">Easy Apply</span>}
                              {profile.deepScrape && <span className="px-2 py-1 bg-slate-800/50 border border-slate-700/50 rounded text-[10px] text-slate-400">Deep Scrape</span>}
                              {profile.hoursOld && <span className="px-2 py-1 bg-slate-800/50 border border-slate-700/50 rounded text-[10px] text-slate-400">{profile.hoursOld}h limit</span>}
                            </div>
                          </div>
                          <button 
                            onClick={() => handleScrape(profile.id)}
                            disabled={profile.isScraping}
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                              profile.isScraping 
                                ? 'bg-slate-800 text-slate-400 cursor-not-allowed' 
                                : 'bg-violet-600 hover:bg-violet-500 text-white shadow-lg shadow-violet-900/50'
                            }`}
                          >
                            {profile.isScraping ? (
                              <><RefreshCw className="w-4 h-4 animate-spin" /> Scraping...</>
                            ) : (
                              <><Play className="w-4 h-4 fill-current" /> Scrape Now</>
                            )}
                          </button>
                        </div>
                        
                        <div className="flex items-center justify-between text-xs border-t border-slate-800/60 pt-4">
                          <div className="text-slate-500 flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-slate-700"></span>
                            Last Run: <span className="text-slate-300 font-medium">
                              {profile.scrapeRuns && profile.scrapeRuns.length > 0 ? profile.scrapeRuns[0].status : "NEVER"}
                            </span>
                          </div>
                          <div className="text-slate-400 bg-slate-900/50 px-2 py-1 rounded-md border border-slate-800">
                            Found: <span className="text-violet-400 font-bold">
                              {profile.scrapeRuns && profile.scrapeRuns.length > 0 ? profile.scrapeRuns[0].jobsFound : 0}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                    {searchProfiles.length === 0 && (
                      <div className="col-span-full bg-slate-800/30 p-8 text-center rounded-xl border border-dashed border-slate-700 text-slate-500">
                        No search profiles yet. Create one or extract from your CV!
                      </div>
                    )}
                  </div>
                </section>
              </>
            )}

            {/* TAB: JOB PIPELINE */}
            {activeTab === 'jobs' && (
              <section>
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-bold text-white flex items-center gap-2">
                    <Briefcase className="w-5 h-5 text-blue-500" />
                    Discovered Jobs
                  </h2>
                  <div className="text-xs font-medium text-slate-500 bg-[#131B2B] px-3 py-1.5 rounded-full border border-slate-800">
                    {jobs.length} Active Listings
                  </div>
                </div>

                <div className="bg-[#131B2B] rounded-xl border border-slate-800/80 overflow-hidden shadow-xl shadow-black/20">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-900/50 border-b border-slate-800 text-xs uppercase tracking-wider text-slate-500">
                          <th className="px-6 py-4 font-medium">Job Title</th>
                          <th className="px-6 py-4 font-medium">Company</th>
                          <th className="px-6 py-4 font-medium">Location</th>
                          <th className="px-6 py-4 font-medium">AI Match</th>
                          <th className="px-6 py-4 font-medium text-right">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/50">
                        {jobs.map((job) => (
                          <tr key={job.id} className="hover:bg-slate-800/20 transition-colors group">
                            <td className="px-6 py-4">
                              <div className="font-semibold text-sm text-slate-200 group-hover:text-violet-400 transition-colors cursor-pointer">
                                {job.title}
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <div className="text-sm text-slate-400 flex items-center gap-2">
                                <div className="w-6 h-6 rounded bg-slate-800 border border-slate-700 flex items-center justify-center text-[10px] font-bold text-slate-300">
                                  {job.company ? job.company.charAt(0).toUpperCase() : '?'}
                                </div>
                                {job.company}
                              </div>
                            </td>
                            <td className="px-6 py-4 text-sm text-slate-500">
                              {job.location}
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-2">
                                <div className="w-full bg-slate-800 rounded-full h-1.5 max-w-[60px]">
                                  <div 
                                    className={`h-1.5 rounded-full ${(job.matchScore || 0) >= 90 ? 'bg-emerald-500' : 'bg-blue-500'}`} 
                                    style={{ width: `${job.matchScore || 0}%` }}
                                  ></div>
                                </div>
                                <span className={`text-xs font-bold ${(job.matchScore || 0) >= 90 ? 'text-emerald-400' : 'text-blue-400'}`}>
                                  {job.matchScore || 0}
                                </span>
                              </div>
                            </td>
                            <td className="px-6 py-4 text-right">
                              {job.status === "DISCOVERED" ? (
                                <button 
                                  onClick={() => handleStatusChange(job.id)}
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-800 text-blue-400 hover:bg-blue-500/10 hover:text-blue-300 border border-slate-700 hover:border-blue-500/30 transition-all"
                                >
                                  DISCOVERED <ChevronRight className="w-3 h-3" />
                                </button>
                              ) : (
                                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-violet-500/10 text-violet-400 border border-violet-500/20">
                                  <FileText className="w-3 h-3" />
                                  TAILORING
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                        {jobs.length === 0 && (
                          <tr>
                            <td colSpan={5} className="px-6 py-8 text-center text-slate-500">
                              No jobs found yet. Trigger a scrape!
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </section>
            )}

            {/* TAB: CV INTELLIGENCE */}
            {activeTab === 'intelligence' && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* CV Intelligence Panel */}
                <div className="bg-[#131B2B] rounded-2xl border border-slate-800/80 overflow-hidden shadow-xl shadow-black/50 relative group h-fit">
                  <div className="absolute inset-0 bg-gradient-to-br from-violet-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"></div>
                  
                  <div className="p-5 border-b border-slate-800/50 flex items-center gap-3">
                    <Brain className="w-5 h-5 text-violet-400" />
                    <h2 className="text-lg font-semibold text-white tracking-wide">CV Intelligence</h2>
                  </div>
                  
                  <div className="p-5 space-y-4">
                    <textarea
                      className="w-full h-48 bg-[#0B0F19] border border-slate-700/80 rounded-xl p-4 text-sm text-slate-300 focus:border-violet-500 focus:ring-1 focus:ring-violet-500 outline-none transition-all placeholder:text-slate-600 font-mono"
                      placeholder="Paste your raw CV/resume text here..."
                      value={cvText}
                      onChange={(e) => setCvText(e.target.value)}
                    />

                    <button 
                      onClick={handleAnalyzeCv}
                      disabled={isAnalyzing || !cvText}
                      className="w-full relative overflow-hidden rounded-xl p-[1px] group/btn disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <span className="absolute inset-0 bg-gradient-to-r from-violet-600 to-fuchsia-600 rounded-xl opacity-80 group-hover/btn:opacity-100 transition-opacity duration-300"></span>
                      <div className="relative bg-[#131B2B] px-4 py-3 rounded-xl flex items-center justify-center gap-2 transition-all duration-300 group-hover/btn:bg-opacity-0">
                        {isAnalyzing ? (
                          <><RefreshCw className="w-4 h-4 text-violet-300 animate-spin" /> <span className="font-semibold text-sm text-white">Analyzing...</span></>
                        ) : (
                          <><Sparkles className="w-4 h-4 text-violet-300 group-hover/btn:text-white transition-colors" /> <span className="font-semibold text-sm text-violet-100 group-hover/btn:text-white transition-colors">Extract Skills & Suggestions</span></>
                        )}
                      </div>
                    </button>
                  </div>
                </div>

                <div className="space-y-8">
                  {/* Core Skills */}
                  <div>
                    <h3 className="text-xs font-bold text-slate-500 tracking-wider uppercase mb-4 px-1">Core Skills</h3>
                    <div className="flex flex-wrap gap-2">
                      {analysisResult?.core_skills ? (
                        analysisResult.core_skills.map((skill: string, idx: number) => (
                          <span key={idx} className="px-3 py-1.5 bg-slate-800/50 hover:bg-slate-700/50 border border-slate-700/50 rounded-lg text-xs font-medium text-slate-300 transition-colors cursor-default">
                            {skill}
                          </span>
                        ))
                      ) : (
                        <div className="text-slate-500 text-sm italic px-1">Run CV Analysis to extract skills.</div>
                      )}
                    </div>
                  </div>

                  {/* Suggested Profiles */}
                  <div>
                    <h3 className="text-xs font-bold text-slate-500 tracking-wider uppercase mb-4 px-1">Suggested Profiles</h3>
                    <div className="space-y-3">
                      {analysisResult?.recommended_search_profiles ? (
                        analysisResult.recommended_search_profiles.map((profile: any, idx: number) => (
                          <div key={idx} className="bg-[#131B2B] p-4 rounded-xl border border-slate-800/80 hover:border-slate-700 transition-colors">
                            <div className="flex items-start justify-between mb-2">
                              <div>
                                <h4 className="font-semibold text-slate-200 text-sm">{profile.searchTerm}</h4>
                                <div className="flex items-center gap-1.5 text-xs text-slate-400 mt-1">
                                  <MapPin className="w-3 h-3 text-rose-400" />
                                  {profile.location}
                                </div>
                              </div>
                              <button 
                                onClick={() => handleAddSuggestedProfile(profile)}
                                className="flex items-center gap-1 px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-300 rounded-md transition-colors"
                              >
                                <Plus className="w-3 h-3" /> Add
                              </button>
                            </div>
                            <p className="text-xs text-slate-500 leading-relaxed mt-3 italic">
                              {profile.rationale}
                            </p>
                          </div>
                        ))
                      ) : (
                        <div className="text-slate-500 text-sm italic px-1">Awaiting analysis for suggestions.</div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

          </div>
        </main>
      </div>

      {/* New Profile / Filter Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-[#131B2B] rounded-2xl border border-slate-800 shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between p-5 border-b border-slate-800/80 bg-slate-900/20">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Settings2 className="w-5 h-5 text-violet-500" />
                Configure Search Filters
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-white transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleAddProfile} className="p-6 space-y-5">
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Profile Name</label>
                <input 
                  type="text" 
                  required
                  placeholder="e.g. EU React Roles" 
                  value={newProfile.name}
                  onChange={(e) => setNewProfile({...newProfile, name: e.target.value})}
                  className="w-full bg-[#0B0F19] border border-slate-700 rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition-all placeholder:text-slate-600"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Keywords (Comma separated)</label>
                <input 
                  type="text" 
                  placeholder="e.g. React, TypeScript, Next.js" 
                  value={newProfile.keywords}
                  onChange={(e) => setNewProfile({...newProfile, keywords: e.target.value})}
                  className="w-full bg-[#0B0F19] border border-slate-700 rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition-all placeholder:text-slate-600"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Location</label>
                  <div className="relative">
                    <MapPin className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input 
                      type="text" 
                      placeholder="e.g. Germany" 
                      disabled={newProfile.remote}
                      value={newProfile.location}
                      onChange={(e) => setNewProfile({...newProfile, location: e.target.value})}
                      className="w-full bg-[#0B0F19] border border-slate-700 rounded-lg pl-9 pr-4 py-2.5 text-sm text-white focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition-all disabled:opacity-30 disabled:cursor-not-allowed placeholder:text-slate-600"
                    />
                  </div>
                </div>
                <div className="flex flex-col justify-end pb-2">
                  <label className="flex items-center gap-2 cursor-pointer group w-fit">
                    <input 
                      type="checkbox" 
                      checked={newProfile.remote}
                      onChange={(e) => setNewProfile({...newProfile, remote: e.target.checked})}
                      className="w-4 h-4 rounded border-slate-700 bg-slate-800 text-violet-500 focus:ring-violet-500 focus:ring-offset-slate-900 cursor-pointer"
                    />
                    <span className="text-sm font-medium text-slate-300 group-hover:text-white transition-colors">Remote Only</span>
                  </label>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Target Job Boards</label>
                  <div className="flex gap-4">
                    {['linkedin', 'indeed', 'glassdoor'].map((platform) => (
                      <label key={platform} className="flex items-center gap-2 cursor-pointer group">
                        <input 
                          type="checkbox" 
                          checked={newProfile.platforms[platform as keyof typeof newProfile.platforms]}
                          onChange={(e) => setNewProfile({...newProfile, platforms: {...newProfile.platforms, [platform]: e.target.checked}})}
                          className="w-4 h-4 rounded border-slate-700 bg-slate-800 text-violet-500 focus:ring-violet-500 focus:ring-offset-slate-900 cursor-pointer"
                        />
                        <span className="text-sm font-medium text-slate-300 capitalize group-hover:text-white transition-colors">{platform}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Job Type</label>
                  <div className="flex flex-wrap gap-x-4 gap-y-2">
                    {['fulltime', 'parttime', 'contract', 'internship'].map((type) => (
                      <label key={type} className="flex items-center gap-2 cursor-pointer group">
                        <input 
                          type="checkbox" 
                          checked={newProfile.jobTypes[type as keyof typeof newProfile.jobTypes]}
                          onChange={(e) => setNewProfile({...newProfile, jobTypes: {...newProfile.jobTypes, [type]: e.target.checked}})}
                          className="w-4 h-4 rounded border-slate-700 bg-slate-800 text-violet-500 focus:ring-violet-500 focus:ring-offset-slate-900 cursor-pointer"
                        />
                        <span className="text-sm font-medium text-slate-300 capitalize group-hover:text-white transition-colors">{type}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Date Posted</label>
                  <select 
                    value={newProfile.hoursOld}
                    onChange={(e) => setNewProfile({...newProfile, hoursOld: Number(e.target.value)})}
                    className="w-full bg-[#0B0F19] border border-slate-700 rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition-all appearance-none"
                  >
                    <option value={24}>Last 24 Hours</option>
                    <option value={72}>Last 3 Days</option>
                    <option value={168}>Last 7 Days</option>
                    <option value={336}>Last 14 Days</option>
                    <option value={720}>Last 30 Days</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Country (Indeed/Glassdoor)</label>
                  <select 
                    value={newProfile.country}
                    onChange={(e) => setNewProfile({...newProfile, country: e.target.value})}
                    className="w-full bg-[#0B0F19] border border-slate-700 rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition-all appearance-none"
                  >
                    <option value="">Auto-detect</option>
                    <option value="USA">USA</option>
                    <option value="UK">UK</option>
                    <option value="Canada">Canada</option>
                    <option value="Germany">Germany</option>
                    <option value="Australia">Australia</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Results Limit</label>
                  <div className="flex items-center gap-3">
                    <input 
                      type="range" 
                      min="10" max="200" step="10"
                      value={newProfile.resultsWanted}
                      onChange={(e) => setNewProfile({...newProfile, resultsWanted: Number(e.target.value)})}
                      className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-violet-500"
                    />
                    <span className="text-sm font-bold text-violet-400 w-8">{newProfile.resultsWanted}</span>
                  </div>
                </div>
              </div>

              <div className="flex gap-6 pt-2">
                <label className="flex items-center gap-2 cursor-pointer group">
                  <div className={`w-10 h-5 rounded-full transition-colors relative ${newProfile.easyApply ? 'bg-violet-500' : 'bg-slate-700'}`}>
                    <div className={`w-3.5 h-3.5 bg-white rounded-full absolute top-[3px] transition-all ${newProfile.easyApply ? 'left-[22px]' : 'left-[3px]'}`}></div>
                  </div>
                  <input type="checkbox" className="hidden" checked={newProfile.easyApply} onChange={(e) => setNewProfile({...newProfile, easyApply: e.target.checked})} />
                  <span className="text-sm font-medium text-slate-300 group-hover:text-white transition-colors">Easy Apply Only</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer group">
                  <div className={`w-10 h-5 rounded-full transition-colors relative ${newProfile.deepScrape ? 'bg-violet-500' : 'bg-slate-700'}`}>
                    <div className={`w-3.5 h-3.5 bg-white rounded-full absolute top-[3px] transition-all ${newProfile.deepScrape ? 'left-[22px]' : 'left-[3px]'}`}></div>
                  </div>
                  <input type="checkbox" className="hidden" checked={newProfile.deepScrape} onChange={(e) => setNewProfile({...newProfile, deepScrape: e.target.checked})} />
                  <span className="text-sm font-medium text-slate-300 group-hover:text-white transition-colors">Deep Scrape (Descriptions)</span>
                </label>
              </div>

              <div className="pt-4 flex gap-3 border-t border-slate-800/80 mt-6">
                <button 
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 px-4 py-2.5 rounded-lg text-sm font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="flex-1 px-4 py-2.5 rounded-lg text-sm font-medium text-white bg-violet-600 hover:bg-violet-500 shadow-lg shadow-violet-900/50 transition-colors"
                >
                  Save Profile
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
