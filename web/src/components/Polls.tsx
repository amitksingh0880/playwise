import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRoomStore } from '../features/room/RoomStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Check, BarChart2 } from 'lucide-react';

export const Polls: React.FC<{ send: (data: any) => void }> = ({ send }) => {
  const { polls, hostId, userId } = useRoomStore();
  const [showCreate, setShowCreate] = useState(false);
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState(['', '']);

  const handleAddOption = () => setOptions([...options, '']);
  
  const handleCreatePoll = () => {
    if (question && options.every(o => o.trim())) {
      send({ type: 'create-poll', question, options });
      setQuestion('');
      setOptions(['', '']);
      setShowCreate(false);
    }
  };

  const handleVote = (pollId: string, optionIndex: number) => {
    send({ type: 'vote-poll', pollId, optionIndex });
  };

  return (
    <div className="flex flex-col h-full gap-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-black text-zinc-400 uppercase tracking-[0.2em] flex items-center gap-2">
          <BarChart2 className="w-4 h-4 text-cyan-400" />
          Polls
        </h3>
        {hostId === userId && (
          <Button 
            size="sm" 
            variant="ghost" 
            onClick={() => setShowCreate(!showCreate)}
            className="h-8 w-8 rounded-full p-0 hover:bg-fuchsia-500/20 text-fuchsia-400"
          >
            <Plus className={`w-4 h-4 transition-transform duration-300 ${showCreate ? 'rotate-45' : ''}`} />
          </Button>
        )}
      </div>

      <AnimatePresence>
        {showCreate && (
          <motion.div
            initial={{ opacity: 0, y: -10, height: 0 }}
            animate={{ opacity: 1, y: 0, height: 'auto' }}
            exit={{ opacity: 0, y: -10, height: 0 }}
            className="bg-white/5 border border-white/10 rounded-2xl p-4 space-y-3 overflow-hidden shadow-xl"
          >
            <Input 
              placeholder="Question" 
              value={question} 
              onChange={e => setQuestion(e.target.value)}
              className="bg-black/40 border-white/10 text-sm font-bold placeholder:text-slate-600"
            />
            <div className="space-y-2">
              {options.map((opt, i) => (
                <Input 
                  key={i} 
                  placeholder={`Option ${i + 1}`} 
                  value={opt} 
                  onChange={e => {
                    const newOpts = [...options];
                    newOpts[i] = e.target.value;
                    setOptions(newOpts);
                  }}
                  className="bg-black/40 border-white/10 text-xs font-medium h-9"
                />
              ))}
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={handleAddOption} className="flex-1 h-9 border-white/10 text-xs font-black uppercase">Add Option</Button>
              <Button size="sm" onClick={handleCreatePoll} className="flex-1 h-9 bg-fuchsia-600 hover:bg-fuchsia-500 text-xs font-black uppercase border-none">Create</Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex-1 space-y-4 overflow-y-auto pr-2 custom-scrollbar">
        {[...polls].reverse().map(poll => (
          <motion.div
            key={poll.id}
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            className="bg-black/40 backdrop-blur-xl border border-white/10 rounded-2xl p-4 shadow-lg group relative overflow-hidden"
          >
             <div className="absolute top-0 left-0 w-1 h-full bg-cyan-500/50" />
             <h4 className="text-sm font-black text-white mb-4 pr-6 leading-tight">{poll.question}</h4>
             
             <div className="space-y-3">
               {poll.options.map((opt, i) => {
                 const percentage = poll.totalVotes > 0 ? (opt.votes / poll.totalVotes) * 100 : 0;
                 const hasVoted = poll.voters.includes(userId!);
                 
                 return (
                   <div key={i} className="space-y-1.5">
                     <button
                       disabled={hasVoted}
                       onClick={() => handleVote(poll.id, i)}
                       className={`w-full flex items-center justify-between text-xs font-bold px-1 transition-colors ${hasVoted ? 'cursor-default' : 'hover:text-cyan-400'}`}
                     >
                       <span className="flex items-center gap-2">
                         {opt.text}
                         {hasVoted && poll.voters[poll.voters.indexOf(userId!)] === userId && poll.options[i].votes > 0 && (
                            // Note: this is a simple check, in real app we'd track which option the user voted for
                            null
                         )}
                       </span>
                       <span className="text-slate-500">{opt.votes} votes ({Math.round(percentage)}%)</span>
                     </button>
                     <div className="relative h-2 w-full bg-white/5 rounded-full overflow-hidden border border-white/5">
                        <motion.div 
                          initial={{ width: 0 }}
                          animate={{ width: `${percentage}%` }}
                          className="absolute h-full bg-gradient-to-r from-cyan-600 to-fuchsia-600 shadow-[0_0_10px_rgba(6,182,212,0.5)]"
                        />
                     </div>
                   </div>
                 );
               })}
             </div>
             
             <div className="mt-4 flex items-center justify-between text-[10px] font-black text-slate-600 uppercase tracking-widest">
               <span>{poll.totalVotes} Total Votes</span>
               {poll.voters.includes(userId!) && (
                 <span className="text-emerald-500 flex items-center gap-1">
                   <Check className="w-3 h-3" /> Voted
                 </span>
               )}
             </div>
          </motion.div>
        ))}
        {polls.length === 0 && (
          <div className="h-40 flex flex-col items-center justify-center text-slate-600 border-2 border-dashed border-white/5 rounded-3xl">
             <BarChart2 className="w-10 h-10 mb-2 opacity-20" />
             <p className="text-xs font-bold uppercase tracking-widest">No active polls</p>
          </div>
        )}
      </div>
    </div>
  );
};
