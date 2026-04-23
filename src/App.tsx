/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, Image as ImageIcon, Compass, User, PlusCircle, Share2, Download, Trash2, Edit3, X, Upload } from 'lucide-react';
import { cn } from './lib/utils';
import { generateImage, editImage, type GeneratedImage } from './services/geminiService';
import { generateUnrestrictedImage } from './services/unrestrictedService';
import confetti from 'canvas-confetti';

type Tab = 'discover' | 'generate' | 'gallery';

const DISCOVER_DATA = [
  { prompt: "Cyberpunk neon Tokyo night, hyperrealistic", ratio: "3:4", seed: 101 },
  { prompt: "Ethereal forest with floating spirits, watercolor", ratio: "1:1", seed: 102 },
  { prompt: "Mechanical clockwork owl, intricate gold gears", ratio: "3:4", seed: 103 },
  { prompt: "Minimalist desert sunset, flat vector art", ratio: "1:1", seed: 104 },
  { prompt: "Ancient ruins overgrown by bioluminescent moss", ratio: "3:4", seed: 105 },
  { prompt: "Astronaut sitting on a pink cloud, dreamcore", ratio: "1:1", seed: 106 },
];

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('generate');
  const [history, setHistory] = useState<GeneratedImage[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedImage, setSelectedImage] = useState<GeneratedImage | null>(null);
  const [editingImage, setEditingImage] = useState<GeneratedImage | null>(null);
  const [storageWarning, setStorageWarning] = useState(false);

  // Load history from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('neocanvas_history');
    if (saved) {
      setHistory(JSON.parse(saved));
    }
  }, []);

  const saveToHistory = (img: GeneratedImage) => {
    let updated = [img, ...history];
    
    // Try to save to localStorage with auto-cleanup if quota exceeded
    const trySave = (items: GeneratedImage[]): boolean => {
      try {
        localStorage.setItem('neocanvas_history', JSON.stringify(items));
        return true;
      } catch (e) {
        if (e instanceof DOMException && (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED')) {
          return false;
        }
        throw e;
      }
    };

    let success = trySave(updated);
    if (!success) {
      while (!success && updated.length > 1) {
        updated = updated.slice(0, -1);
        success = trySave(updated);
        if (success) {
          setStorageWarning(true);
          setTimeout(() => setStorageWarning(false), 5000);
        }
      }
    }

    setHistory(updated);
    setEditingImage(null);
  };

  const deleteFromHistory = (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    const updated = history.filter(img => img.id !== id);
    setHistory(updated);
    localStorage.setItem('neocanvas_history', JSON.stringify(updated));
    if (selectedImage?.id === id) setSelectedImage(null);
    if (editingImage?.id === id) setEditingImage(null);
  };

  return (
    <div className="flex flex-col min-h-screen bg-black text-white font-sans overflow-hidden">
      {/* Header */}
      <header className="px-6 py-4 border-b border-white/10 flex items-center justify-between bg-black/80 backdrop-blur-xl sticky top-0 z-40">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-vivid-purple flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-black" />
          </div>
          <h1 className="font-display text-2xl tracking-tighter uppercase text-vivid-purple">NeoCanvas</h1>
        </div>
        <button className="p-2 rounded-full glass transition-colors">
          <User className="w-5 h-5" />
        </button>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto pb-24 px-4 pt-4">
        <AnimatePresence mode="wait">
          {activeTab === 'discover' && (
            <motion.div
              key="discover"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              <h2 className="font-display text-5xl uppercase tracking-tighter">Discover</h2>
              <div className="grid grid-cols-2 gap-4">
                {DISCOVER_DATA.map((item, i) => (
                  <div key={i} className={cn("rounded-2xl glass overflow-hidden relative group", item.ratio === '3:4' ? "aspect-[3/4]" : "aspect-square")}>
                    <img
                      src={`https://picsum.photos/seed/${item.seed}/600/${item.ratio === '3:4' ? 800 : 600}`}
                      alt="Trending"
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                      referrerPolicy="no-referrer"
                    />
                    <div className="absolute inset-x-0 bottom-0 p-4 bg-gradient-to-t from-black/90 to-transparent">
                      <p className="text-[9px] uppercase tracking-widest text-vivid-purple font-bold mb-1">Inspiration</p>
                      <p className="text-xs line-clamp-2 font-bold leading-tight">{item.prompt}</p>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {activeTab === 'generate' && (
            <motion.div
              key="generate"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
            >
               <GeneratorComponent 
                 onGenerate={saveToHistory} 
                 isGenerating={isGenerating} 
                 setIsGenerating={setIsGenerating} 
                 initialImage={editingImage}
                 onClearInitial={() => setEditingImage(null)}
                 onImageImport={(img) => setEditingImage(img)}
               />
            </motion.div>
          )}

          {activeTab === 'gallery' && (
            <motion.div
              key="gallery"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              <div className="flex items-center justify-between">
                <h2 className="font-display text-5xl tracking-tighter uppercase">Studio</h2>
                <span className="text-[10px] font-bold text-white/40 uppercase tracking-[0.2em]">{history.length} ITEMS</span>
              </div>
              
              {history.length === 0 ? (
                <div className="py-20 flex flex-col items-center justify-center text-center space-y-6">
                  <div className="w-20 h-20 rounded-[32px] glass flex items-center justify-center">
                    <ImageIcon className="w-10 h-10 text-vivid-purple opacity-40" />
                  </div>
                  <div className="space-y-2">
                    <p className="text-xl font-bold">No creations yet</p>
                    <p className="text-white/40 text-sm max-w-[200px]">Your masterpiece gallery is waiting for your first idea</p>
                  </div>
                  <button 
                    onClick={() => setActiveTab('generate')}
                    className="px-8 py-3 rounded-full border border-vivid-purple text-vivid-purple text-xs uppercase font-bold tracking-widest hover:bg-vivid-purple hover:text-white transition-all"
                  >
                    Start Creating
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  {history.map((img) => (
                    <motion.div
                      layoutId={img.id}
                      key={img.id}
                      className="aspect-square rounded-3xl glass overflow-hidden relative cursor-pointer group"
                      onClick={() => setSelectedImage(img)}
                    >
                      <img src={img.url} alt={img.prompt} className="w-full h-full object-cover transition-transform group-hover:scale-105" referrerPolicy="no-referrer" />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                         <div className="w-12 h-12 rounded-full glass flex items-center justify-center">
                            <PlusCircle className="w-6 h-6 text-white" />
                         </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Detail Modal */}
      <AnimatePresence>
        {selectedImage && (
          <motion.div
             initial={{ opacity: 0 }}
             animate={{ opacity: 1 }}
             exit={{ opacity: 0 }}
             className="fixed inset-0 z-[60] flex flex-col pt-12"
          >
            <div className="absolute inset-0 bg-black/95 backdrop-blur-md" onClick={() => setSelectedImage(null)} />
            
            <motion.div 
               layoutId={selectedImage.id}
               className="relative z-10 w-full max-w-lg mx-auto aspect-square px-4"
            >
              <img src={selectedImage.url} alt={selectedImage.prompt} className="w-full h-full object-contain rounded-3xl shadow-2xl shadow-neon-lime/20" referrerPolicy="no-referrer" />
            </motion.div>

            <motion.div 
              initial={{ y: 200, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 200, opacity: 0 }}
              className="relative z-10 mt-auto glass border-t border-white/20 rounded-t-[40px] px-8 pt-8 pb-16 flex flex-col space-y-8"
            >
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-[9px] uppercase tracking-[0.2em] text-vivid-purple font-bold">Generation Detail</p>
                  <p className="text-xl font-bold tracking-tight pr-4 leading-tight">{selectedImage.prompt}</p>
                </div>
                <button onClick={() => setSelectedImage(null)} className="p-4 glass rounded-full hover:bg-white/10">
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="grid grid-cols-4 gap-6">
                <ActionButton icon={Share2} label="Share" onClick={() => {
                   if (navigator.share) {
                     navigator.share({
                       title: 'NeoCanvas Creation',
                       text: selectedImage.prompt,
                       url: selectedImage.url
                     });
                   } else {
                     navigator.clipboard.writeText(selectedImage.url);
                   }
                }} />
                <ActionButton icon={Download} label="Save" onClick={() => {
                  const link = document.createElement('a');
                  link.href = selectedImage.url;
                  link.download = `neocanvas-${selectedImage.id}.png`;
                  link.click();
                }} />
                <ActionButton icon={Edit3} label="Refine" onClick={() => {
                  setEditingImage(selectedImage);
                  setActiveTab('generate');
                  setSelectedImage(null);
                }} />
                <ActionButton icon={Trash2} label="Discard" variant="danger" onClick={() => deleteFromHistory(selectedImage.id)} />
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Storage Warning */}
      <AnimatePresence>
        {storageWarning && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed bottom-28 inset-x-6 z-[100]"
          >
            <div className="glass bg-red-500/10 border-red-500/20 px-6 py-3 rounded-full flex items-center justify-between shadow-2xl">
              <p className="text-xs font-bold text-red-500 uppercase tracking-widest">Storage Full: Rotating History</p>
              <button onClick={() => setStorageWarning(false)}><X className="w-4 h-4 text-red-500" /></button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Tab Navigation */}
      <nav className="fixed bottom-0 inset-x-0 bg-black/80 backdrop-blur-3xl border-t border-white/10 py-4 px-10 flex justify-between items-center z-50 h-24">
        <NavButton active={activeTab === 'discover'} icon={Compass} label="Explore" onClick={() => setActiveTab('discover')} />
        <div className="relative -top-10">
           <button 
             onClick={() => setActiveTab('generate')}
             className={cn(
               "w-16 h-16 rounded-full bg-vivid-purple flex items-center justify-center text-white neon-border shadow-2xl shadow-vivid-purple/40 transition-all active:scale-95",
               activeTab === 'generate' && "scale-125 bg-white text-black border-white shadow-white/20"
             )}
           >
             <PlusCircle className="w-8 h-8" />
           </button>
        </div>
        <NavButton active={activeTab === 'gallery'} icon={ImageIcon} label="Studio" onClick={() => setActiveTab('gallery')} />
      </nav>
    </div>
  );
}

function NavButton({ active, icon: Icon, label, onClick }: { active: boolean, icon: any, label: string, onClick: () => void }) {
  return (
    <button onClick={onClick} className={cn("flex flex-col items-center gap-1.5 transition-all", active ? "text-vivid-purple" : "text-white/40 hover:text-white")}>
      <Icon className={cn("w-6 h-6", active && "animate-pulse")} />
      <span className="text-[9px] font-bold tracking-[0.2em] uppercase">{label}</span>
      {active && <motion.div layoutId="nav-dot" className="w-1.5 h-1.5 rounded-full bg-vivid-purple mt-0.5" />}
    </button>
  );
}

function ActionButton({ icon: Icon, label, onClick, variant = 'default' }: { icon: any, label: string, onClick: () => void, variant?: 'default' | 'danger' }) {
  return (
    <button onClick={onClick} className="flex flex-col items-center gap-3 group">
      <div className={cn(
        "w-14 h-14 rounded-2xl flex items-center justify-center transition-all group-hover:scale-110 active:scale-95",
        variant === 'danger' ? "bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white" : "glass text-white/70 hover:bg-white/20 hover:text-white"
      )}>
        <Icon className="w-5 h-5" />
      </div>
      <span className={cn("text-[10px] font-bold uppercase tracking-widest", variant === 'danger' ? "text-red-500" : "text-white/40")}>{label}</span>
    </button>
  );
}

function GeneratorComponent({ onGenerate, isGenerating, setIsGenerating, initialImage, onClearInitial, onImageImport }: { onGenerate: (img: GeneratedImage) => void, isGenerating: boolean, setIsGenerating: (v: boolean) => void, initialImage?: GeneratedImage | null, onClearInitial?: () => void, onImageImport?: (img: GeneratedImage) => void }) {
  const [engine, setEngine] = useState<'gemini' | 'unrestricted'>('gemini');

  return (
    <div className="space-y-10">
      <div className="space-y-4 relative">
        <div className="absolute -top-10 -left-10 w-40 h-40 bg-vivid-purple/20 blur-[80px] rounded-full pointer-events-none" />
        <h2 className={cn("text-massive")}>
          Creative<br/><span className="text-vivid-purple">Studios</span>
        </h2>
        <p className="text-white/40 text-xs font-bold uppercase tracking-[0.2em] max-w-[280px]">
          Access your professional image generation suites directly
        </p>
      </div>

      <div className="flex gap-2 glass p-1 rounded-full w-fit">
        <button 
          onClick={() => setEngine('gemini')}
          className={cn(
            "px-6 py-2 rounded-full text-[10px] font-bold uppercase tracking-widest transition-all",
            engine === 'gemini' ? "bg-white text-black" : "text-white/40 hover:text-white"
          )}
        >
          Pro Suite (Restricted)
        </button>
        <button 
          onClick={() => setEngine('unrestricted')}
          className={cn(
            "px-6 py-2 rounded-full text-[10px] font-bold uppercase tracking-widest transition-all",
            engine === 'unrestricted' ? "bg-vivid-purple text-white shadow-lg shadow-vivid-purple/20" : "text-white/40 hover:text-white"
          )}
        >
          Infinity Suite (Unrestricted)
        </button>
      </div>

      <motion.div 
        key={engine}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full h-[85vh] rounded-[40px] overflow-hidden glass border border-white/10 relative shadow-2xl"
      >
        <div className="absolute top-0 inset-x-0 h-12 bg-black/40 backdrop-blur-md border-b border-white/5 flex items-center px-6 justify-between z-10">
          <div className="flex items-center gap-2">
             <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
             <span className="text-[10px] font-bold uppercase tracking-widest text-white/40">
               Live: {engine === 'gemini' ? 'ai-image-generator-restricted' : 'ai-image-generator-unrestricted'}
             </span>
          </div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-vivid-purple">Secure Proxy Active</p>
        </div>
        <iframe 
          src={engine === 'gemini' ? "/api/proxy/perchance-restricted" : "/api/proxy/perchance-unrestricted"} 
          className="w-full h-full pt-12"
          title="Perchance Studio"
        />
      </motion.div>
    </div>
  );
}
