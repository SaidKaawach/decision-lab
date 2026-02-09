import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ResponsiveContainer, Legend } from 'recharts';
import { TrendingUp, TrendingDown, AlertCircle, CheckCircle, ArrowRight, Brain, Activity, Edit3, PlayCircle, RefreshCw, Zap, Shield, Trophy, Target } from 'lucide-react';
import { Analytics } from '@vercel/analytics/react';

// --- Styles & Animation Helpers ---
const ANIMATIONS = `
  @keyframes float {
    0% { transform: translateY(0px); }
    50% { transform: translateY(-10px); }
    100% { transform: translateY(0px); }
  }
  @keyframes shake {
    0%, 100% { transform: translateX(0); }
    25% { transform: translateX(-5px); }
    75% { transform: translateX(5px); }
  }
  @keyframes pop {
    0% { transform: scale(0.9); opacity: 0; }
    100% { transform: scale(1); opacity: 1; }
  }
  @keyframes glow {
    0% { box-shadow: 0 0 5px rgba(59, 130, 246, 0.5); }
    50% { box-shadow: 0 0 20px rgba(59, 130, 246, 0.8); }
    100% { box-shadow: 0 0 5px rgba(59, 130, 246, 0.5); }
  }
  .animate-float { animation: float 3s ease-in-out infinite; }
  .animate-shake { animation: shake 0.4s cubic-bezier(.36,.07,.19,.97) both; }
  .animate-pop { animation: pop 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards; }
  .animate-glow { animation: glow 2s infinite; }
`;

// --- UI Components ---
const Card = ({ children, className = "", noPadding = false }) => (
  <div className={`backdrop-blur-xl bg-white/10 border border-white/20 rounded-2xl shadow-2xl overflow-hidden ${noPadding ? '' : 'p-6'} ${className}`}>
    {children}
  </div>
);

const Badge = ({ icon: Icon, label, color = "blue" }) => {
  const colors = {
    blue: "bg-blue-500/20 text-blue-300 border-blue-500/50",
    emerald: "bg-emerald-500/20 text-emerald-300 border-emerald-500/50",
    rose: "bg-rose-500/20 text-rose-300 border-rose-500/50",
    amber: "bg-amber-500/20 text-amber-300 border-amber-500/50",
    purple: "bg-purple-500/20 text-purple-300 border-purple-500/50",
  };
  return (
    <div className={`flex items-center gap-2 px-3 py-1 rounded-full border ${colors[color]} backdrop-blur-md`}>
      <Icon className="w-4 h-4" />
      <span className="text-xs font-bold uppercase tracking-wider">{label}</span>
    </div>
  );
};

const Button = ({ onClick, children, variant = "primary", disabled = false, className = "" }) => {
  const baseStyle = "px-8 py-4 rounded-xl font-bold transition-all transform hover:scale-[1.02] active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed";
  const variants = {
    primary: "bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-lg shadow-blue-900/50 border border-blue-400/20",
    danger: "bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white shadow-lg shadow-rose-900/50 border border-rose-400/20",
    outline: "bg-white/5 hover:bg-white/10 border-2 border-white/20 text-white backdrop-blur-sm",
    ghost: "text-slate-300 hover:text-white hover:bg-white/5",
  };
  return (
    <button onClick={onClick} disabled={disabled} className={`${baseStyle} ${variants[variant]} ${className}`}>
      {children}
    </button>
  );
};

const Slider = ({ value, onChange, min, max, label, format = (v) => v }) => (
  <div className="w-full space-y-4 bg-black/20 p-4 rounded-xl border border-white/10">
    <div className="flex justify-between items-end">
      <label className="text-sm font-bold text-slate-300 uppercase tracking-wide">{label}</label>
      <span className="font-mono font-bold text-blue-400 text-2xl">{format(value)}</span>
    </div>
    <input 
      type="range" 
      min={min} 
      max={max} 
      value={value} 
      onChange={(e) => onChange(parseInt(e.target.value))}
      className="w-full h-4 bg-slate-700 rounded-full appearance-none cursor-pointer accent-blue-500 hover:accent-blue-400 transition-all"
    />
  </div>
);

// --- Main App ---
export default function App() {
  const [stage, setStage] = useState('intro'); // intro, game, graph-builder, analysis
  const [round, setRound] = useState(0);
  const [balance, setBalance] = useState(1000);
  const [displayBalance, setDisplayBalance] = useState(1000); // For animation
  const [shake, setShake] = useState(false);
  const [history, setHistory] = useState([]);
  
  // Interactive inputs
  const [sliderValue, setSliderValue] = useState(90);
  const [textInput, setTextInput] = useState("");
  
  // Game State
  const [showExplanation, setShowExplanation] = useState(false);
  const [lastOutcome, setLastOutcome] = useState(null);

  // Predictions
  const [userGainPrediction, setUserGainPrediction] = useState(50);
  const [userLossPrediction, setUserLossPrediction] = useState(80);

  // Balance Animation Effect
  useEffect(() => {
    if (balance === displayBalance) return;
    const diff = balance - displayBalance;
    const step = diff / 10;
    
    const interval = setInterval(() => {
      setDisplayBalance(prev => {
        const next = prev + step;
        if ((step > 0 && next >= balance) || (step < 0 && next <= balance)) {
          clearInterval(interval);
          return balance;
        }
        return next;
      });
    }, 30);
    return () => clearInterval(interval);
  }, [balance, displayBalance]);

  const scenarios = [
    {
      id: "gains",
      type: "binary",
      title: "The Gain Domain",
      prompt: "You receive a $1,000 grant!",
      sub: "Choose your path wisely.",
      options: [
        { type: "safe", text: "Secure $500 Profit", value: 500, icon: Shield },
        { type: "risky", text: "Gamble for $1,000", ev: 500, icon: Zap }
      ],
      concept: "Risk Aversion",
      badge: "Safety First",
      explanation: "Most people choose the sure $500. This is Risk Aversion in the gain domain. We prefer certainty over a gamble with the same expected value."
    },
    {
      id: "losses",
      type: "binary",
      title: "The Loss Domain",
      prompt: "Disaster! A tax of $2,000 is due.",
      sub: "You must mitigate the damage.",
      options: [
        { type: "safe", text: "Accept $500 Loss", value: -500, icon: Shield },
        { type: "risky", text: "Gamble: Lose $1,000 or $0", ev: -500, icon: Zap }
      ],
      concept: "Risk Seeking",
      badge: "Double or Nothing",
      explanation: "Suddenly, people become gamblers! We hate sure losses so much we'll risk a bigger disaster just for a chance to break even."
    },
    {
      id: "grades",
      type: "slider",
      title: "The Grade Gamble",
      prompt: "You have a B+ Average.",
      sub: "How high must the reward be to risk dropping to a C?",
      min: 80,
      max: 100,
      start: 95,
      labels: { min: "80 (B-)", max: "100 (A+)" },
      concept: "Status Quo Bias",
      explanation: "Did you demand a 95% or higher? That's Status Quo Bias. We overvalue what we currently have (the B+) and demand a huge premium to risk it."
    },
    {
      id: "endowment",
      type: "text",
      title: "The Seller's Dilemma",
      prompt: "You own a Limited Edition Mug.",
      question: "Why does selling it feel harder than buying it felt good?",
      concept: "Endowment Effect",
      explanation: "Once you own it, it's yours. Giving it up feels like a loss. Buying it is just a gain. Since losses hurt more, you demand a higher price."
    }
  ];

  const triggerShake = () => {
    setShake(true);
    setTimeout(() => setShake(false), 500);
  };

  const handleBinaryChoice = (option) => {
    let val = option.value;
    let actualOutcome = val;

    if (option.type === "risky") {
      const win = Math.random() > 0.5;
      if (round === 0) actualOutcome = win ? 1000 : 0; 
      if (round === 1) actualOutcome = win ? -1000 : 0; 
    }
    
    if (actualOutcome < 0) triggerShake();
    
    setLastOutcome({ ...option, actualValue: actualOutcome });
    setBalance(b => b + actualOutcome);
    setHistory([...history, { round, type: option.type, value: actualOutcome }]);
    setShowExplanation(true);
  };

  const handleSliderSubmit = () => {
    setLastOutcome({ type: "slider", val: sliderValue });
    setHistory([...history, { round, type: "slider", value: sliderValue }]);
    setShowExplanation(true);
  };

  const handleTextSubmit = () => {
    if (textInput.length < 3) return;
    setLastOutcome({ type: "text", text: textInput });
    setHistory([...history, { round, type: "text", value: textInput }]);
    setShowExplanation(true);
  };

  const nextRound = () => {
    setShowExplanation(false);
    setTextInput("");
    setSliderValue(scenarios[round + 1]?.start || 90);
    
    if (round < scenarios.length - 1) {
      setRound(r => r + 1);
    } else {
      setStage('graph-builder');
    }
  };

  // --- RENDERERS ---

  const renderIntro = () => (
    <div className="flex flex-col items-center justify-center min-h-[80vh] text-center max-w-4xl mx-auto px-4 relative z-10">
      <div className="animate-float mb-8 bg-white/10 p-8 rounded-full border border-white/20 backdrop-blur-xl shadow-[0_0_50px_rgba(59,130,246,0.5)]">
        <Brain className="w-24 h-24 text-blue-400" />
      </div>
      
      <h1 className="text-6xl md:text-7xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-300 via-white to-purple-300 mb-4 tracking-tight drop-shadow-2xl">
        DECISION LAB
      </h1>
      
      <div className="mb-10 flex flex-col items-center gap-2 animate-pop" style={{animationDelay: '0.2s'}}>
        <div className="px-4 py-1.5 rounded-full bg-white/5 border border-white/10 backdrop-blur-md flex items-center gap-3 text-sm md:text-base font-medium text-blue-200">
           <span className="text-blue-400 font-bold">BHE0014</span>
           <span className="w-1 h-1 rounded-full bg-white/30"></span>
           <span>University of Huddersfield</span>
        </div>
        <p className="text-slate-400 text-sm font-bold tracking-[0.2em] uppercase mt-2">
            Instructor: Said Kaawach
        </p>
      </div>

      <p className="text-xl md:text-2xl text-blue-100/80 max-w-2xl leading-relaxed mb-12 font-light">
        Are you a rational machine or a human being? <br/>
        <span className="font-bold text-white">We're about to find out.</span>
      </p>

      <Button onClick={() => setStage('game')} className="text-xl px-12 py-6 animate-glow">
        ENTER SIMULATION <ArrowRight className="w-6 h-6" />
      </Button>

      <div className="mt-16 flex gap-8 text-sm text-slate-400 font-mono">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4" /> 5 MIN SESSION
        </div>
        <div className="flex items-center gap-2">
          <Target className="w-4 h-4" /> LIVE ANALYSIS
        </div>
      </div>
    </div>
  );

  const renderScenario = () => {
    const current = scenarios[round];

    // --- RESULT CARD ---
    if (showExplanation) {
      return (
        <div className="max-w-2xl mx-auto pt-10 animate-pop">
           <Card className="border-t-4 border-blue-500 bg-slate-900/90">
            <div className="flex items-center gap-4 mb-8">
              <div className="bg-gradient-to-br from-blue-500 to-purple-600 p-4 rounded-xl shadow-lg">
                <Brain className="w-8 h-8 text-white" />
              </div>
              <div>
                <h2 className="text-3xl font-bold text-white">Analysis Complete</h2>
                <div className="flex items-center gap-2 mt-1">
                   <Badge icon={Target} label={current.concept} color="purple"/>
                </div>
              </div>
            </div>

            <div className="bg-black/30 p-6 rounded-xl border border-white/10 mb-8">
              <p className="text-xl text-slate-200 leading-relaxed font-light">
                {current.explanation}
              </p>
              {current.type === 'text' && (
                <div className="mt-4 pt-4 border-t border-white/10">
                  <p className="text-xs font-bold text-slate-500 uppercase mb-2">Your Output:</p>
                  <p className="font-mono text-blue-300">"{lastOutcome.text}"</p>
                </div>
              )}
            </div>

            <div className="flex justify-end">
              <Button onClick={nextRound}>
                {round === scenarios.length - 1 ? "FINALIZE PROFILE" : "NEXT LEVEL"} <ArrowRight className="w-5 h-5" />
              </Button>
            </div>
          </Card>
        </div>
      );
    }

    // --- GAMEPLAY CARD ---
    return (
      <div className={`max-w-3xl mx-auto pt-4 ${shake ? 'animate-shake' : ''}`}>
        <div className="flex justify-between items-end mb-6 px-2">
          <div>
            <span className="text-blue-400 font-bold tracking-widest text-xs uppercase">Level {round + 1}</span>
            <h2 className="text-4xl font-bold text-white mt-1">{current.title}</h2>
          </div>
          <div className="text-right">
             <div className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-1">Current Balance</div>
             <div className={`text-3xl font-mono font-bold ${displayBalance < 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                ${Math.round(displayBalance).toLocaleString()}
             </div>
          </div>
        </div>
        
        <Card className="min-h-[400px] flex flex-col justify-between backdrop-blur-xl bg-slate-900/60 border-slate-700">
          <div className="mb-8">
            <div className="bg-blue-500/10 border-l-4 border-blue-500 p-6 rounded-r-xl">
              <p className="text-2xl font-medium text-white mb-2">{current.prompt}</p>
              <p className="text-lg text-blue-200">{current.sub}</p>
            </div>
          </div>

          {current.type === 'binary' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {current.options.map((opt, idx) => (
                <button
                  key={idx}
                  onClick={() => handleBinaryChoice(opt)}
                  className="group relative p-8 rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 hover:border-blue-500/50 hover:shadow-[0_0_30px_rgba(59,130,246,0.3)] transition-all duration-300 text-left"
                >
                  <div className="absolute top-4 right-4 opacity-50 group-hover:opacity-100 transition-opacity">
                    <opt.icon className="w-6 h-6 text-blue-400"/>
                  </div>
                  <span className="block font-bold text-sm text-slate-400 uppercase tracking-wider mb-2">Option {String.fromCharCode(65 + idx)}</span>
                  <p className="text-xl text-white font-bold group-hover:text-blue-300 transition-colors">{opt.text}</p>
                </button>
              ))}
            </div>
          )}

          {current.type === 'slider' && (
            <div className="py-8 px-4">
              <Slider 
                min={current.min} 
                max={current.max} 
                value={sliderValue} 
                onChange={setSliderValue}
                label="Success Rate Required (%)"
                format={(v) => `${v}%`}
              />
              <div className="mt-12 flex justify-center">
                <Button onClick={handleSliderSubmit} className="w-full">
                  Lock In Decision
                </Button>
              </div>
            </div>
          )}

          {current.type === 'text' && (
            <div className="space-y-6">
              <div className="bg-black/20 p-4 rounded-xl border border-white/5">
                <p className="text-slate-300 italic">"{current.question}"</p>
              </div>
              <textarea
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                placeholder="Type your reasoning..."
                className="w-full p-6 rounded-xl border border-white/10 bg-black/40 text-white placeholder-slate-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all min-h-[120px] text-lg"
              />
              <Button onClick={handleTextSubmit} disabled={textInput.length < 3} className="w-full">
                Submit Analysis
              </Button>
            </div>
          )}
        </Card>
      </div>
    );
  };

  const renderGraphBuilder = () => (
    <div className="max-w-3xl mx-auto pt-12 animate-pop">
      <div className="text-center mb-10">
        <h2 className="text-4xl font-black text-white mb-4">Calibrate Your Intuition</h2>
        <p className="text-xl text-slate-300">
           Before the big reveal, we need one last input.
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-8 mb-10">
        <Card className="bg-emerald-900/20 border-emerald-500/30">
          <div className="flex items-center gap-3 mb-6">
             <div className="p-2 bg-emerald-500/20 rounded-lg">
                <TrendingUp className="w-6 h-6 text-emerald-400"/> 
             </div>
             <h3 className="font-bold text-xl text-emerald-300">Pleasure of +$100</h3>
          </div>
          <Slider 
            min={0} max={100} value={userGainPrediction} onChange={setUserGainPrediction}
            label="Joy Level"
          />
        </Card>
        
        <Card className="bg-rose-900/20 border-rose-500/30">
          <div className="flex items-center gap-3 mb-6">
             <div className="p-2 bg-rose-500/20 rounded-lg">
                <TrendingDown className="w-6 h-6 text-rose-400"/> 
             </div>
             <h3 className="font-bold text-xl text-rose-300">Pain of -$100</h3>
          </div>
          <Slider 
            min={0} max={150} value={userLossPrediction} onChange={setUserLossPrediction}
            label="Pain Level"
          />
        </Card>
      </div>

      <div className="text-center">
           <Button onClick={() => setStage('analysis')} className="mx-auto text-xl px-16 py-5 shadow-[0_0_40px_rgba(59,130,246,0.4)]">
             REVEAL MY PROFILE <Zap className="w-5 h-5 fill-current"/>
           </Button>
      </div>
    </div>
  );

  const renderAnalysis = () => {
    // Data Generation
    const data = [];
    const userGainSlope = userGainPrediction / 100;
    const userLossSlope = userLossPrediction / 100;

    for (let x = -200; x <= 200; x += 10) {
      const theoryY = x >= 0 ? Math.pow(x, 0.88) : -2.25 * Math.pow(Math.abs(x), 0.88);
      const userY = x >= 0 ? x * userGainSlope : x * userLossSlope;
      data.push({ x, theoryY, userY });
    }

    const ratio = (userLossPrediction / (userGainPrediction || 1)).toFixed(2);
    const isRational = ratio < 1.2;

    return (
      <div className="max-w-6xl mx-auto pb-12 animate-pop">
        <div className="flex flex-col md:flex-row justify-between items-end mb-8 border-b border-white/10 pb-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
                <h2 className="text-4xl font-black text-white">PROFILE GENERATED</h2>
                {isRational ? 
                    <Badge icon={Brain} label="Hyper-Rational" color="purple"/> : 
                    <Badge icon={Activity} label="Human Biased" color="blue"/> 
                }
            </div>
            <p className="text-slate-400 text-lg">Comparing your intuition vs. Prospect Theory (Kahneman & Tversky)</p>
          </div>
          <Button onClick={() => window.location.reload()} variant="outline" className="mt-4 md:mt-0">
            <RefreshCw className="w-4 h-4" /> RESTART SIM
          </Button>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          <Card className="lg:col-span-2 h-[500px] bg-slate-900 relative border-slate-700" noPadding>
             <div className="absolute top-6 left-6 z-10">
                 <h3 className="font-bold text-white mb-1">The Value Function v(x)</h3>
                 <div className="flex gap-4 text-xs">
                     <span className="flex items-center gap-1 text-blue-400"><div className="w-3 h-3 bg-blue-500 rounded-full"></div> Prospect Theory</span>
                     <span className="flex items-center gap-1 text-emerald-400"><div className="w-3 h-3 bg-emerald-500 rounded-full"></div> You</span>
                 </div>
             </div>
             <ResponsiveContainer width="100%" height="100%">
               <LineChart data={data} margin={{ top: 40, right: 30, bottom: 30, left: 10 }}>
                 <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.5} />
                 <XAxis dataKey="x" type="number" domain={[-200, 200]} stroke="#94a3b8" />
                 <YAxis stroke="#94a3b8" />
                 <Tooltip 
                    contentStyle={{ backgroundColor: '#0f172a', color: '#fff', borderRadius: '12px', border: '1px solid #334155' }}
                    formatter={(value) => value.toFixed(1)}
                 />
                 <ReferenceLine x={0} stroke="#64748b" />
                 <ReferenceLine y={0} stroke="#64748b" />
                 <Line type="monotone" dataKey="theoryY" stroke="#3b82f6" strokeWidth={4} dot={false} />
                 <Line type="linear" dataKey="userY" stroke="#10b981" strokeWidth={3} strokeDasharray="8 8" dot={false} />
               </LineChart>
             </ResponsiveContainer>
          </Card>

          <div className="space-y-6">
             <Card className="bg-gradient-to-br from-rose-900/40 to-slate-900 border-rose-500/30">
                <div className="flex items-start justify-between mb-4">
                    <div>
                        <h3 className="font-bold text-rose-300 flex items-center gap-2">
                            <TrendingDown className="w-4 h-4" /> LOSS AVERSION
                        </h3>
                        <p className="text-xs text-rose-200/60 mt-1">Multiplier of Pain vs Pleasure</p>
                    </div>
                    <div className="text-3xl font-mono font-bold text-white">{ratio}x</div>
                </div>
                <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                    <div className="bg-rose-500 h-full transition-all duration-1000" style={{ width: `${Math.min((ratio/3)*100, 100)}%` }}></div>
                </div>
                <p className="text-xs text-slate-400 mt-3">
                    Target (Theory): 2.25x. {ratio > 2.25 ? "You hate losing more than average!" : "You are relatively calm about losses."}
                </p>
             </Card>

             <Card className="bg-slate-800/50 border-slate-700">
                <h3 className="font-bold text-blue-300 mb-3 flex items-center gap-2">
                    <Edit3 className="w-4 h-4" /> ENDOWMENT EFFECT
                </h3>
                <div className="bg-black/30 p-4 rounded-lg border border-white/5 italic text-slate-300 text-sm">
                    "{history.find(h => h.type === 'text')?.value || '...'}"
                </div>
             </Card>

             <div className="bg-blue-600/20 border border-blue-500/30 p-4 rounded-xl flex items-start gap-4">
                <Trophy className="w-8 h-8 text-yellow-400 shrink-0" />
                <div>
                    <h4 className="font-bold text-white text-sm uppercase">Key Takeaway</h4>
                    <p className="text-xs text-blue-200 mt-1">
                        We don't think in absolute wealth. We think in <strong>gains and losses</strong> relative to a reference point.
                    </p>
                </div>
             </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[#0f172a] text-slate-200 font-sans p-4 transition-colors duration-200 overflow-x-hidden selection:bg-blue-500/30">
      <style>{ANIMATIONS}</style>
      
      <div className="fixed inset-0 pointer-events-none z-0">
         <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-blue-600/20 rounded-full blur-[120px] mix-blend-screen opacity-50 animate-float" />
         <div className="absolute bottom-[-10%] right-[-10%] w-[600px] h-[600px] bg-purple-600/20 rounded-full blur-[120px] mix-blend-screen opacity-50 animate-float" style={{animationDelay: '2s'}} />
      </div>

      <main className="max-w-6xl mx-auto h-full pt-6 relative z-10">
        <nav className="flex justify-between items-center mb-8 px-2">
            <div className="flex items-center gap-2 font-black text-xl tracking-tighter text-white">
                <Brain className="text-blue-500" />
                ECON<span className="text-blue-500">LAB</span>
            </div>
            {stage !== 'intro' && (
                <div className="flex items-center gap-4 bg-white/5 px-4 py-2 rounded-full border border-white/10 backdrop-blur-md">
                    <Activity className="w-4 h-4 text-emerald-400" />
                    <span className="font-mono font-bold text-white">${Math.round(displayBalance)}</span>
                </div>
            )}
        </nav>

        {stage === 'intro' && renderIntro()}
        {stage === 'game' && renderScenario()}
        {stage === 'graph-builder' && renderGraphBuilder()}
        {stage === 'analysis' && renderAnalysis()}
      </main>
      <Analytics />
    </div>
  );
}
