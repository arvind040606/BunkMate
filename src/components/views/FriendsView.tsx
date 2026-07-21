import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Users,
  UserPlus,
  Search,
  Check,
  CheckCircle2,
  XCircle,
  Clock,
  Sparkles,
  ShieldAlert,
  RefreshCw,
  Plus,
  MessageSquare,
  Sparkle
} from 'lucide-react';
import { friendsService } from '../../utils/friendsService';
import { triggerHaptic, db } from '../../utils/db';
import { syncService } from '../../utils/syncService';
import FriendProfileModal from './FriendProfileModal';
import { renderAvatar } from './CompleteProfileModal';

interface FriendsViewProps {
  onOpenLogin: () => void;
  onScroll?: (e: React.UIEvent<HTMLDivElement>) => void;
}

interface FriendItem {
  username: string;
  status: 'pending_sent' | 'pending_received' | 'accepted';
  isSender: boolean;
  isOnline?: boolean;
  displayName?: string | null;
  avatarId?: string | null;
}

export default function FriendsView({ onOpenLogin, onScroll }: FriendsViewProps) {
  const [friendsList, setFriendsList] = useState<FriendItem[]>([]);
  const [suggestionsList, setSuggestionsList] = useState<{ username: string; displayName?: string | null; avatarId?: string | null; }[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<{ username: string; displayName?: string | null; avatarId?: string | null; }[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isLoadingList, setIsLoadingList] = useState(true);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [selectedFriend, setSelectedFriend] = useState<FriendItem | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'buddies' | 'suggested' | 'pending'>('buddies');

  const isLoggedIn = !!(db.getPrefs().syncEnabled && db.getPrefs().syncToken);

  const handleManualRefresh = async () => {
    if (isRefreshing || !isLoggedIn) return;
    try {
      setIsRefreshing(true);
      setError(null);
      setSuccessMessage(null);
      triggerHaptic('light');
      await syncService.performSync().catch(console.error);
      await Promise.all([
        fetchFriends(false),
        fetchSuggestions()
      ]);
    } catch (err: any) {
      setError(err.message || 'Refresh failed.');
    } finally {
      setIsRefreshing(false);
    }
  };

  const fetchSuggestions = async () => {
    if (!isLoggedIn) {
      setIsLoadingSuggestions(false);
      return;
    }
    try {
      setIsLoadingSuggestions(true);
      const data = await friendsService.suggestions();
      if (data.success) {
        setSuggestionsList(data.suggestions);
      }
    } catch (err: any) {
      console.error('Failed to load suggestions:', err);
    } finally {
      setIsLoadingSuggestions(false);
    }
  };

  const fetchFriends = async (silent = false) => {
    if (!isLoggedIn) {
      if (!silent) setIsLoadingList(false);
      return;
    }
    try {
      if (!silent) setIsLoadingList(true);
      const data = await friendsService.list();
      if (data.success) {
        setFriendsList(data.friends);
      }
    } catch (err: any) {
      console.error(err);
      if (!silent) setError(err.message || 'Failed to retrieve friends.');
    } finally {
      if (!silent) setIsLoadingList(false);
    }
  };

  useEffect(() => {
    if (!isLoggedIn) {
      setIsLoadingList(false);
      return;
    }
    fetchFriends();
    fetchSuggestions();
    syncService.performSync().catch(console.error);

    const interval = setInterval(() => {
      fetchFriends(true);
    }, 3000);

    const unsubscribe = syncService.subscribeToUserUpdates(() => {
      fetchFriends(true);
    });

    return () => {
      clearInterval(interval);
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const query = searchQuery.trim();
    if (!query) return;

    const myUsername = db.getPrefs().syncUsername;
    if (myUsername && query.toLowerCase() === myUsername.toLowerCase()) {
      setError(`You cannot search for or add yourself! @${myUsername} is your own Bunkmate account.`);
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    setError(null);
    try {
      const data = await friendsService.search(query);
      if (data.success) {
        setSearchResults(data.matches);
        if (data.matches.length === 0) {
          setError(`No student found with username "@${query}".`);
        }
      }
    } catch (err: any) {
      setError(err.message || 'Search request failed.');
    } finally {
      setIsSearching(false);
    }
  };

  const handleAddFriend = async (targetUsername: string) => {
    triggerHaptic('medium');
    try {
      const data = await friendsService.sendRequest(targetUsername);
      if (data.success) {
        setSuccessMessage(`Friend request sent to @${targetUsername}!`);
        setSearchQuery('');
        setSearchResults([]);
        fetchFriends();
        fetchSuggestions();
      }
    } catch (err: any) {
      setError(err.message || 'Failed to send request.');
    }
  };

  const handleRespondRequest = async (targetUsername: string, accept: boolean) => {
    triggerHaptic('heavy');
    try {
      const data = await friendsService.respond(targetUsername, accept);
      if (data.success) {
        setSuccessMessage(accept ? `Accepted ${targetUsername}!` : `Rejected request.`);
        fetchFriends();
        fetchSuggestions();
      }
    } catch (err: any) {
      setError(err.message || 'Response submission failed.');
    }
  };

  const pendingReceived = friendsList.filter(f => f.status === 'pending_received');
  const pendingSent = friendsList.filter(f => f.status === 'pending_sent');
  const acceptedFriends = friendsList.filter(f => f.status === 'accepted');

  return (
    <div
      onScroll={onScroll}
      className="h-full overflow-y-auto px-4 pt-6 pb-32 bg-black text-white select-none space-y-6"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-white flex items-center gap-2">
            👥 Class Buddies
          </h1>
          <p className="text-xs text-zinc-400 font-medium">Connect and share attendance with friends</p>
        </div>
        {isLoggedIn && (
          <button
            onClick={handleManualRefresh}
            disabled={isRefreshing || isLoadingList}
            className="p-3 bg-zinc-900/90 border border-zinc-800 rounded-2xl text-zinc-350 hover:text-white hover:bg-zinc-800 disabled:opacity-50 transition-all active:scale-95 shadow-lg flex items-center gap-2 text-xs font-semibold"
          >
            <RefreshCw className={`w-4 h-4 text-indigo-400 ${isRefreshing ? 'animate-spin' : ''}`} />
            Sync Now
          </button>
        )}
      </div>

      {!isLoggedIn ? (
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-3xl bg-zinc-900 border border-zinc-800 p-8 text-center space-y-5 shadow-xl max-w-md mx-auto"
        >
          <div className="w-16 h-16 bg-indigo-500/10 rounded-full flex items-center justify-center border border-indigo-500/20 mx-auto">
            <Users className="w-8 h-8 text-indigo-400" />
          </div>
          <h4 className="text-lg font-bold text-white tracking-tight">Access Friends & Sharing</h4>
          <p className="text-zinc-400 text-xs leading-relaxed">
            Connect with classmate profiles, share your attendance records live, and get real-time status updates. Register or sign into a Cloud Account to get started!
          </p>
          <button
            onClick={() => {
              triggerHaptic('medium');
              onOpenLogin();
            }}
            className="w-full py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold rounded-2xl text-xs shadow-lg hover:brightness-110 transition-all"
          >
            Sign In / Create Cloud Account
          </button>
        </motion.div>
      ) : (
        <div className="space-y-6">
          {/* Segmented Tab Selector */}
          <div className="flex bg-zinc-900/80 p-1 rounded-2xl border border-zinc-850">
            <button
              onClick={() => { triggerHaptic('light'); setActiveTab('buddies'); }}
              className={`flex-1 py-3 text-xs font-black rounded-xl transition-all flex items-center justify-center space-x-1.5 cursor-pointer ${
                activeTab === 'buddies'
                  ? 'bg-zinc-800 text-white shadow-sm border border-zinc-700/30'
                  : 'text-zinc-550 hover:text-zinc-300'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>Buddies</span>
            </button>
            <button
              onClick={() => { triggerHaptic('light'); setActiveTab('suggested'); }}
              className={`flex-1 py-3 text-xs font-black rounded-xl transition-all flex items-center justify-center space-x-1.5 cursor-pointer ${
                activeTab === 'suggested'
                  ? 'bg-zinc-800 text-white shadow-sm border border-zinc-700/30'
                  : 'text-zinc-555 hover:text-zinc-300'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
              <span>Suggested</span>
            </button>
            <button
              onClick={() => { triggerHaptic('light'); setActiveTab('pending'); }}
              className={`flex-1 py-3 text-xs font-black rounded-xl transition-all flex items-center justify-center space-x-1.5 cursor-pointer relative ${
                activeTab === 'pending'
                  ? 'bg-zinc-800 text-white shadow-sm border border-zinc-700/30'
                  : 'text-zinc-550 hover:text-zinc-300'
              }`}
            >
              <Clock className="w-3.5 h-3.5 text-amber-500" />
              <span>Pending</span>
              {(pendingReceived.length > 0 || pendingSent.length > 0) && (
                <span className="ml-1 px-1.5 py-0.5 text-[9px] bg-amber-500 text-black font-black rounded-full leading-none min-w-[14px] text-center">
                  {pendingReceived.length + pendingSent.length}
                </span>
              )}
            </button>
          </div>

          {/* Feedback banners */}
          {error && (
            <div className="bg-rose-500/10 border border-rose-500/20 rounded-2xl p-4 flex items-start space-x-2 text-rose-400 text-xs font-semibold">
              <ShieldAlert className="w-4 h-4 text-rose-500 mt-0.5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {successMessage && (
            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-4 flex items-start space-x-2 text-emerald-400 text-xs font-semibold">
              <CheckCircle2 className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* Tab Contents */}
          {activeTab === 'suggested' && (
            <div className="space-y-6">
              {/* Search section */}
              <div className="bg-zinc-900 border border-zinc-800 p-5 rounded-3xl space-y-3">
                <h4 className="text-[10px] font-mono font-black uppercase tracking-wider text-zinc-500">
                  Search & Add Friends
                </h4>
                <form onSubmit={handleSearch} className="flex space-x-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3.5 top-3 w-4 h-4 text-zinc-500" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ''))}
                      placeholder="Enter student username..."
                      className="w-full pl-10 pr-4 py-3 bg-zinc-950 border border-zinc-800 text-white rounded-2xl focus:outline-none focus:border-indigo-500 focus:bg-zinc-900 text-xs font-bold transition placeholder:text-zinc-600"
                    />
                  </div>
                  {isSearching ? (
                    <div className="px-4 flex items-center justify-center bg-zinc-950 border border-zinc-800 rounded-2xl">
                      <RefreshCw className="w-4 h-4 text-indigo-400 animate-spin" />
                    </div>
                  ) : (
                    <button
                      type="submit"
                      className="px-5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl text-xs font-semibold transition cursor-pointer"
                    >
                      Find
                    </button>
                  )}
                </form>

                {searchResults.map(match => (
                  <div key={match.username} className="flex justify-between items-center bg-zinc-950 border border-zinc-800/80 p-3.5 rounded-2xl text-left mt-3">
                    <div className="flex items-center space-x-2.5">
                      {renderAvatar(match.avatarId || undefined, match.displayName || match.username, 'w-8 h-8 text-xs')}
                      <div>
                        <span className="block text-xs font-black text-white leading-tight">
                          {match.displayName || match.username}
                        </span>
                        <span className="block text-[9px] text-indigo-400 font-bold mt-0.5 font-mono">
                          @{match.username}
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={() => handleAddFriend(match.username)}
                      className="p-2 bg-indigo-600/10 hover:bg-indigo-600 text-indigo-400 hover:text-white border border-indigo-500/20 rounded-xl transition cursor-pointer"
                    >
                      <UserPlus className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>

              {/* Suggestions list */}
              <div className="space-y-3">
                <h4 className="text-xs font-mono font-black uppercase tracking-wider text-zinc-500">
                  Suggested Buddies
                </h4>
                {isLoadingSuggestions ? (
                  <div className="text-center py-6">
                    <RefreshCw className="w-6 h-6 animate-spin text-zinc-700 mx-auto" />
                  </div>
                ) : suggestionsList.length === 0 ? (
                  <div className="text-center py-6 bg-zinc-900/20 rounded-2xl border border-zinc-900">
                    <p className="text-xs text-zinc-500 font-semibold">No suggestions found.</p>
                  </div>
                ) : (
                  <div className="grid gap-3">
                    {suggestionsList.map(item => (
                      <div key={item.username} className="flex justify-between items-center bg-zinc-900 border border-zinc-800 p-3.5 rounded-2xl">
                        <div className="flex items-center space-x-2.5">
                          {renderAvatar(item.avatarId || undefined, item.displayName || item.username, 'w-8 h-8 text-xs')}
                          <div>
                            <span className="block text-xs font-black text-white leading-tight">
                              {item.displayName || item.username}
                            </span>
                            <span className="block text-[9px] text-zinc-500 font-bold font-mono">
                              @{item.username}
                            </span>
                          </div>
                        </div>
                        <button
                          onClick={() => handleAddFriend(item.username)}
                          className="px-3.5 py-1.5 bg-zinc-800 hover:bg-indigo-600 text-zinc-200 hover:text-white rounded-xl text-xs font-black transition cursor-pointer border border-zinc-700 flex items-center space-x-1"
                        >
                          <UserPlus className="w-3.5 h-3.5" />
                          <span>Add</span>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'pending' && (
            <div className="space-y-6">
              {/* Requests Received */}
              <div className="space-y-3">
                <h4 className="text-xs font-mono font-black uppercase tracking-wider text-zinc-500">
                  Received Requests ({pendingReceived.length})
                </h4>
                {pendingReceived.length === 0 ? (
                  <div className="text-center py-5 bg-zinc-900/20 rounded-2xl border border-zinc-900">
                    <p className="text-[10px] text-zinc-500 font-semibold">No incoming buddy requests.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {pendingReceived.map(req => (
                      <div key={req.username} className="flex justify-between items-center bg-zinc-900 border border-zinc-800 p-3.5 rounded-2xl text-left">
                        <div className="flex items-center space-x-2.5">
                          {renderAvatar(req.avatarId || undefined, req.displayName || req.username, 'w-8 h-8 text-xs')}
                          <div>
                            <span className="block text-xs font-black text-white leading-tight">
                              {req.displayName || req.username}
                            </span>
                            <span className="block text-[9px] text-zinc-500 font-bold mt-0.5 font-mono">
                              @{req.username}
                            </span>
                          </div>
                        </div>
                        <div className="flex space-x-1.5">
                          <button
                            onClick={() => handleRespondRequest(req.username, true)}
                            className="p-2 bg-indigo-600 text-white rounded-xl hover:brightness-110 transition cursor-pointer"
                          >
                            <Check className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleRespondRequest(req.username, false)}
                            className="p-2 bg-zinc-800 text-zinc-400 rounded-xl hover:text-white transition cursor-pointer border border-zinc-700"
                          >
                            <XCircle className="w-4 h-4 text-red-500" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Requests Sent */}
              <div className="space-y-3">
                <h4 className="text-xs font-mono font-black uppercase tracking-wider text-zinc-500">
                  Sent Requests ({pendingSent.length})
                </h4>
                {pendingSent.length === 0 ? (
                  <div className="text-center py-5 bg-zinc-900/20 rounded-2xl border border-zinc-900">
                    <p className="text-[10px] text-zinc-500 font-semibold">No outgoing pending requests.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {pendingSent.map(req => (
                      <div key={req.username} className="flex justify-between items-center bg-zinc-900 border border-zinc-800 p-3.5 rounded-2xl text-left">
                        <div className="flex items-center space-x-2.5">
                          {renderAvatar(req.avatarId || undefined, req.displayName || req.username, 'w-8 h-8 text-xs')}
                          <div>
                            <span className="block text-xs font-black text-white leading-tight">
                              {req.displayName || req.username}
                            </span>
                            <span className="block text-[9px] text-zinc-550 font-bold mt-0.5 font-mono">
                              @{req.username}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center space-x-1.5">
                          <span className="text-[9px] font-mono uppercase bg-zinc-950 text-zinc-500 border border-zinc-850 px-2 py-0.5 rounded-full font-bold">
                            Pending
                          </span>
                          <button
                            onClick={() => handleRespondRequest(req.username, false)}
                            className="p-1 bg-rose-950/40 hover:bg-rose-900/40 text-rose-450 rounded-lg transition cursor-pointer"
                            title="Cancel Invite"
                          >
                            <XCircle className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'buddies' && (
            <div className="space-y-6">
              {/* Active Friends List */}
              <div className="space-y-3">
                <h4 className="text-xs font-mono font-black uppercase tracking-wider text-zinc-500">
                  My Class Buddies ({acceptedFriends.length})
                </h4>

                {isLoadingList ? (
                  <div className="text-center py-8">
                    <RefreshCw className="w-6 h-6 animate-spin text-zinc-700 mx-auto" />
                    <p className="text-[10px] text-zinc-500 mt-2">Loading buddies list...</p>
                  </div>
                ) : acceptedFriends.length === 0 ? (
                  <div className="text-center py-10 bg-zinc-900/20 rounded-3xl border border-zinc-900">
                    <Users className="w-8 h-8 text-zinc-700 mx-auto mb-2" />
                    <p className="text-xs font-bold text-zinc-300 font-display">No buddies added yet</p>
                    <p className="text-[10px] text-zinc-500 mt-1">Switch to the "Suggested" tab to find buddies!</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {acceptedFriends.map(friend => (
                      <FriendCard 
                        key={friend.username} 
                        friend={friend} 
                        onSelect={() => {
                          triggerHaptic('light');
                          setSelectedFriend(friend);
                        }}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Friend Profile Modal Overlay */}
      <AnimatePresence>
        {selectedFriend && (
          <FriendProfileModal
            username={selectedFriend.username}
            isOnlineInitial={selectedFriend.isOnline}
            initialAvatarId={selectedFriend.avatarId}
            initialDisplayName={selectedFriend.displayName}
            onClose={() => setSelectedFriend(null)}
            onFriendRemoved={() => {
              fetchFriends();
              setSelectedFriend(null);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// Inline Friend Card Subcomponent for modular clean code
function FriendCard({ friend, onSelect }: { friend: FriendItem; onSelect: () => void }) {
  const [stats, setStats] = useState<any | null>(null);

  useEffect(() => {
    let active = true;
    const loadStats = async () => {
      try {
        const data = await friendsService.getStats(friend.username);
        if (data.success && active) {
          setStats(data);
        }
      } catch (err) {
        console.error('Error fetching friend stats card:', err);
      }
    };
    loadStats();
    return () => { active = false; };
  }, [friend.username]);

  const getColorMeta = (pct: number) => {
    if (pct >= 85) return { bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', text: 'text-emerald-400', ring: '#10B981' };
    if (pct >= 75) return { bg: 'bg-indigo-500/10', border: 'border-indigo-500/20', text: 'text-indigo-400', ring: '#6366F1' };
    if (pct >= 60) return { bg: 'bg-amber-500/10', border: 'border-amber-500/20', text: 'text-amber-500', ring: '#F59E0B' };
    return { bg: 'bg-rose-500/10', border: 'border-rose-500/20', text: 'text-rose-400', ring: '#EF4444' };
  };

  const pct = stats ? stats.overallPercentage : 0;
  const colorMeta = getColorMeta(pct);

  return (
    <div 
      onClick={onSelect}
      className={`p-4 rounded-3xl bg-zinc-900 border border-zinc-800/80 hover:border-zinc-700 hover:bg-zinc-850/80 cursor-pointer transition-all active:scale-[0.99] flex flex-col space-y-3.5`}
    >
      <div className="flex justify-between items-start">
        <div className="flex items-center space-x-3 text-left">
          <div className="relative">
            {renderAvatar(friend.avatarId || undefined, friend.displayName || friend.username, 'w-11 h-11 border-2 border-zinc-800')}
            <span className={`absolute bottom-0.5 right-0.5 w-3 h-3 rounded-full border-2 border-zinc-900 ${friend.isOnline ? 'bg-emerald-500' : 'bg-zinc-550'}`} />
          </div>
          <div>
            <h4 className="text-sm font-black text-white tracking-tight flex items-center gap-1 leading-tight">
              {friend.displayName || friend.username}
            </h4>
            <span className="block text-[10px] text-zinc-500 font-bold mt-0.5 font-mono">
              @{friend.username}
            </span>
          </div>
        </div>

        <div className="flex items-center space-x-2 shrink-0">
          {stats ? (
            <div className={`flex items-center space-x-2 px-2.5 py-1.5 rounded-2xl ${colorMeta.bg} ${colorMeta.border} border`}>
              <span className={`text-[11px] font-mono font-black ${colorMeta.text}`}>
                {stats.overallPercentage}%
              </span>
              <div className="relative w-7 h-7 flex items-center justify-center shrink-0">
                <svg className="w-7 h-7 transform -rotate-90">
                  <circle cx="14" cy="14" r="11" className="stroke-zinc-850 fill-transparent" strokeWidth="2.5" />
                  <circle 
                    cx="14" 
                    cy="14" 
                    r="11" 
                    stroke={colorMeta.ring} 
                    className="fill-transparent" 
                    strokeWidth="2.5"
                    strokeDasharray="69.1"
                    strokeDashoffset={69.1 - (69.1 * Math.min(100, stats.overallPercentage)) / 100}
                    strokeLinecap="round"
                    style={{ transition: 'stroke-dashoffset 0.8s ease' }}
                  />
                </svg>
              </div>
            </div>
          ) : (
            <RefreshCw className="w-4 h-4 animate-spin text-zinc-700" />
          )}
        </div>
      </div>

      {stats && (
        <>
          <div className="border-t border-zinc-850/60 my-1" />
          <div className="grid grid-cols-3 gap-2 text-center pt-0.5">
            <div className="bg-zinc-955 p-1.5 rounded-xl border border-zinc-850">
              <span className="block text-[8px] font-black text-zinc-500 uppercase">Streak</span>
              <span className="text-[10px] font-mono font-black text-amber-500">
                🔥 {stats.currentStreak || 0}d
              </span>
            </div>
            <div className="bg-zinc-955 p-1.5 rounded-xl border border-zinc-850">
              <span className="block text-[8px] font-black text-zinc-500 uppercase">Today</span>
              <span className="text-[10px] font-mono font-black text-indigo-400">
                {stats.todaySchedule ? `${stats.todaySchedule.length} cls` : '0 cls'}
              </span>
            </div>
            <div className="bg-zinc-955 p-1.5 rounded-xl border border-zinc-850">
              <span className="block text-[8px] font-black text-zinc-550 uppercase">Synced</span>
              <span className="text-[9px] font-mono font-bold text-zinc-400 truncate">
                {stats.updatedAt ? new Date(stats.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Recent'}
              </span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
