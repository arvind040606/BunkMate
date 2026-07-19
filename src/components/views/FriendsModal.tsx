import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Users, UserPlus, Search, Check, CheckCircle2, XCircle, Clock, Sparkles, ShieldAlert, RefreshCw } from 'lucide-react';
import { friendsService } from '../../utils/friendsService';
import { triggerHaptic, db } from '../../utils/db';
import { syncService } from '../../utils/syncService';
import FriendProfileModal from './FriendProfileModal';
import { renderAvatar } from './CompleteProfileModal';

interface FriendsModalProps {
  onClose: () => void;
}

interface FriendItem {
  username: string;
  status: 'pending_sent' | 'pending_received' | 'accepted';
  isSender: boolean;
  isOnline?: boolean;
  displayName?: string | null;
  avatarId?: string | null;
}

export default function FriendsModal({ onClose }: FriendsModalProps) {
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

  const handleManualRefresh = async () => {
    if (isRefreshing) return;
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
    const query = searchQuery.trim();
    if (!query) {
      setSearchResults([]);
      return;
    }

    const myUsername = db.getPrefs().syncUsername;
    if (myUsername && query.toLowerCase() === myUsername.toLowerCase()) {
      setError(`You cannot search for or add yourself! @${myUsername} is your own Bunkmate account.`);
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    setError(null);

    const delayDebounceFn = setTimeout(async () => {
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
    }, 250);

    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
  };

  const handleSendRequest = async (targetUsername: string) => {
    setError(null);
    setSuccessMessage(null);
    triggerHaptic('medium');

    try {
      const data = await friendsService.sendRequest(targetUsername);
      if (data.success) {
        setSuccessMessage(`Friend request sent to ${targetUsername}!`);
        setSearchResults([]);
        setSearchQuery('');
        setSuggestionsList(prev => prev.filter(s => s.username !== targetUsername));
        fetchFriends();
      }
    } catch (err: any) {
      setError(err.message || 'Failed to send invite.');
    }
  };

  const handleRespondRequest = async (targetUsername: string, accept: boolean) => {
    setError(null);
    setSuccessMessage(null);
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
    <div className="absolute inset-0 bg-black/60 backdrop-blur-md z-50 flex items-end justify-center select-none">
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 25, stiffness: 220 }}
        className="w-full max-w-[440px] bg-zinc-955 rounded-t-[32px] shadow-2xl flex flex-col h-[94%] overflow-hidden border-t border-zinc-900 text-white"
      >
        {/* Header Drag Indicator and Title */}
        <div className="flex flex-col items-center pt-3 pb-4 px-6 border-b border-zinc-900 flex-shrink-0">
          <div className="w-12 h-1.5 bg-zinc-800 rounded-full mb-3" />
          <div className="flex justify-between items-center w-full">
            <h3 className="text-xl font-display font-black text-white tracking-tight flex items-center">
              <Users className="w-5 h-5 mr-1.5 text-indigo-400" />
              Friends Dashboard
              <button
                onClick={handleManualRefresh}
                disabled={isRefreshing || isLoadingList}
                className="ml-2 px-2 py-0.5 bg-zinc-900 hover:bg-zinc-850 disabled:opacity-50 text-[10px] font-bold text-zinc-400 hover:text-indigo-400 rounded-lg border border-zinc-800 transition flex items-center space-x-1 cursor-pointer"
                title="Force refresh friends list"
              >
                <RefreshCw className={`w-2.5 h-2.5 ${isRefreshing ? 'animate-spin text-indigo-400' : ''}`} />
                <span>Sync</span>
              </button>
            </h3>
            <button
              onClick={() => { triggerHaptic('light'); onClose(); }}
              className="p-1.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-350 rounded-full transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Premium Segmented Tab Selector */}
        <div className="px-6 py-2.5 border-b border-zinc-900 flex-shrink-0 flex bg-zinc-955">
          <div className="flex w-full bg-zinc-900/80 p-1 rounded-xl border border-zinc-850">
            <button
              onClick={() => { triggerHaptic('light'); setActiveTab('buddies'); }}
              className={`flex-1 py-2 text-xs font-black rounded-lg transition-all flex items-center justify-center space-x-1.5 cursor-pointer ${
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
              className={`flex-1 py-2 text-xs font-black rounded-lg transition-all flex items-center justify-center space-x-1.5 cursor-pointer ${
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
              className={`flex-1 py-2 text-xs font-black rounded-lg transition-all flex items-center justify-center space-x-1.5 cursor-pointer relative ${
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
        </div>

        {/* Scrollable Container */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-thin scrollbar-thumb-zinc-850 scrollbar-track-transparent">
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

          {activeTab === 'suggested' ? (
            /* Tab Content: Suggested Bunkmates & Search */
            <div className="space-y-6">
              {/* Search Section */}
              <div className="space-y-3">
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
                      className="w-full pl-10 pr-4 py-2.5 bg-zinc-900/50 border border-zinc-850 text-white rounded-xl focus:outline-none focus:border-indigo-500 focus:bg-zinc-900 text-xs font-bold transition placeholder:text-zinc-660"
                    />
                  </div>
                  {isSearching ? (
                    <div className="px-4 flex items-center justify-center bg-zinc-900 border border-zinc-800 rounded-xl">
                      <RefreshCw className="w-4 h-4 text-indigo-400 animate-spin" />
                    </div>
                  ) : (
                    <button
                      type="submit"
                      className="px-4 bg-indigo-650 hover:bg-indigo-600 text-white rounded-xl text-xs font-semibold transition cursor-pointer"
                    >
                      Search
                    </button>
                  )}
                </form>

                {/* Search Results */}
                {searchResults.length > 0 && (
                  <div className="bg-zinc-900/40 border border-zinc-900 rounded-2xl p-3 divide-y divide-zinc-850">
                    {searchResults.map(result => {
                      const relation = friendsList.find(f => f.username.toLowerCase() === result.username.toLowerCase());
                      return (
                        <div key={result.username} className="flex justify-between items-center py-2.5 text-left">
                          <div className="flex items-center space-x-2.5">
                            {renderAvatar(result.avatarId || undefined, result.displayName || result.username, 'w-8 h-8 text-xs')}
                            <div>
                              <span className="block text-xs font-black text-white leading-tight">
                                {result.displayName || result.username}
                              </span>
                              <span className="block text-[9px] text-zinc-550 font-bold mt-0.5 font-mono">
                                @{result.username}
                              </span>
                            </div>
                          </div>
                          
                          {/* Dynamic button based on friendship relationship */}
                          {!relation && (
                            <button
                              onClick={() => handleSendRequest(result.username)}
                              className="px-3 py-1.5 bg-indigo-950 hover:bg-indigo-900 text-indigo-400 rounded-lg text-[10px] font-bold border border-indigo-900/30 transition cursor-pointer flex items-center space-x-1"
                            >
                              <UserPlus className="w-3.5 h-3.5" />
                              <span>Send Invite</span>
                            </button>
                          )}
                          
                          {relation && relation.status === 'pending_sent' && (
                            <div className="flex items-center space-x-1.5">
                              <span className="text-[9px] font-mono uppercase bg-zinc-900 text-zinc-500 border border-zinc-800 px-2 py-0.5 rounded-full font-bold">
                                Sent
                              </span>
                              <button
                                onClick={() => handleRespondRequest(result.username, false)}
                                className="p-1 bg-rose-950/40 hover:bg-rose-900/40 text-rose-400 rounded-lg transition cursor-pointer"
                                title="Cancel Invite"
                              >
                                <XCircle className="w-4 h-4" />
                              </button>
                            </div>
                          )}

                          {relation && relation.status === 'pending_received' && (
                            <div className="flex space-x-1.5">
                              <button
                                onClick={() => handleRespondRequest(result.username, false)}
                                className="p-1.5 bg-rose-950/40 hover:bg-rose-900/40 text-rose-400 rounded-lg transition cursor-pointer"
                                title="Decline request"
                              >
                                <XCircle className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleRespondRequest(result.username, true)}
                                className="p-1.5 bg-emerald-950/40 hover:bg-emerald-900/40 text-emerald-400 rounded-lg transition cursor-pointer"
                                title="Accept request"
                              >
                                <CheckCircle2 className="w-4 h-4" />
                              </button>
                            </div>
                          )}

                          {relation && relation.status === 'accepted' && (
                            <span className="text-[9px] font-mono uppercase bg-emerald-950/30 text-emerald-400 border border-emerald-900/20 px-2.5 py-0.5 rounded-full font-bold flex items-center space-x-0.5">
                              <Check className="w-3 h-3 text-emerald-400" />
                              <span>Buddy</span>
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Suggestions Section */}
              {!isSearching && searchQuery === '' && (
                <div className="space-y-3">
                  <div className="flex items-center space-x-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-indigo-400 animate-pulse" />
                    <h4 className="text-[10px] font-mono font-black uppercase tracking-wider text-zinc-500">
                      Suggested Bunkmates
                    </h4>
                  </div>
                  
                  {isLoadingSuggestions ? (
                    <div className="text-center py-8">
                      <RefreshCw className="w-5 h-5 animate-spin text-zinc-700 mx-auto" />
                    </div>
                  ) : suggestionsList.length === 0 ? (
                    <div className="text-center py-6 bg-zinc-900/10 rounded-2xl border border-zinc-900">
                      <p className="text-[10px] text-zinc-500 font-medium">No new suggestions at the moment.</p>
                    </div>
                  ) : (
                    <div className="bg-zinc-900/40 border border-zinc-900 rounded-2xl p-3 divide-y divide-zinc-850">
                      {suggestionsList.map(sug => {
                        const relation = friendsList.find(f => f.username.toLowerCase() === sug.username.toLowerCase());
                        return (
                          <div key={sug.username} className="flex justify-between items-center py-2.5 text-left">
                            <div className="flex items-center space-x-2.5">
                              {renderAvatar(sug.avatarId || undefined, sug.displayName || sug.username, 'w-8 h-8 text-xs')}
                              <div>
                                <span className="block text-xs font-black text-white leading-tight">
                                  {sug.displayName || sug.username}
                                </span>
                                <span className="block text-[9px] text-zinc-550 font-bold mt-0.5 font-mono">
                                  @{sug.username}
                                </span>
                              </div>
                            </div>
                            
                            {!relation && (
                              <button
                                onClick={() => handleSendRequest(sug.username)}
                                className="px-3 py-1 bg-indigo-950 hover:bg-indigo-900 text-indigo-400 rounded-lg text-[10px] font-bold border border-indigo-900/30 transition cursor-pointer flex items-center space-x-1"
                              >
                                <UserPlus className="w-3.5 h-3.5" />
                                <span>Add</span>
                              </button>
                            )}

                            {relation && relation.status === 'pending_sent' && (
                              <div className="flex items-center space-x-1.5">
                                <span className="text-[9px] font-mono uppercase bg-zinc-900 text-zinc-500 border border-zinc-800 px-2 py-0.5 rounded-full font-bold">
                                  Sent
                                </span>
                                <button
                                  onClick={() => handleRespondRequest(sug.username, false)}
                                  className="p-1 bg-rose-950/40 hover:bg-rose-900/40 text-rose-400 rounded-lg transition cursor-pointer"
                                  title="Cancel Invite"
                                >
                                  <XCircle className="w-4 h-4" />
                                </button>
                              </div>
                            )}

                            {relation && relation.status === 'pending_received' && (
                              <div className="flex space-x-1.5">
                                <button
                                  onClick={() => handleRespondRequest(sug.username, false)}
                                  className="p-1.5 bg-rose-950/40 hover:bg-rose-900/40 text-rose-400 rounded-lg transition cursor-pointer"
                                  title="Decline request"
                                >
                                  <XCircle className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => handleRespondRequest(sug.username, true)}
                                  className="p-1.5 bg-emerald-950/40 hover:bg-emerald-900/40 text-emerald-400 rounded-lg transition cursor-pointer"
                                  title="Accept request"
                                >
                                  <CheckCircle2 className="w-4 h-4" />
                                </button>
                              </div>
                            )}

                            {relation && relation.status === 'accepted' && (
                              <span className="text-[9px] font-mono uppercase bg-emerald-950/30 text-emerald-400 border border-emerald-900/20 px-2.5 py-0.5 rounded-full font-bold flex items-center space-x-0.5">
                                <Check className="w-3 h-3 text-emerald-400" />
                                <span>Buddy</span>
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : activeTab === 'pending' ? (
            /* Tab Content: Pending Requests */
            <div className="space-y-6">
              {/* Pending Invites Received */}
              <div className="space-y-2.5">
                <h4 className="text-xs font-mono font-black uppercase tracking-wider text-amber-500 flex items-center space-x-1">
                  <span>Friend Requests Received</span>
                  <span className="text-[10px] bg-amber-950/60 text-amber-400 px-2 py-0.5 rounded-full font-bold font-mono">
                    {pendingReceived.length}
                  </span>
                </h4>
                {pendingReceived.length === 0 ? (
                  <div className="text-center py-5 bg-zinc-900/10 rounded-2xl border border-zinc-900">
                    <p className="text-[10px] text-zinc-500 font-semibold">No incoming requests.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {pendingReceived.map(req => (
                      <div key={req.username} className="flex justify-between items-center bg-amber-950/10 border border-amber-900/20 p-3 rounded-2xl text-left">
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
                        <div className="flex space-x-1.5">
                          <button
                            onClick={() => handleRespondRequest(req.username, false)}
                            className="p-1.5 bg-rose-950/40 hover:bg-rose-900/40 text-rose-400 rounded-lg transition cursor-pointer"
                            title="Decline request"
                          >
                            <XCircle className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleRespondRequest(req.username, true)}
                            className="p-1.5 bg-emerald-950/40 hover:bg-emerald-900/40 text-emerald-400 rounded-lg transition cursor-pointer"
                            title="Accept request"
                          >
                            <CheckCircle2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Pending Requests Sent */}
              <div className="space-y-2.5">
                <h4 className="text-xs font-mono font-black uppercase tracking-wider text-zinc-500 flex items-center space-x-1">
                  <span>Sent Invites Pending</span>
                  <span className="text-[10px] bg-zinc-900 text-zinc-400 px-2 py-0.5 rounded-full font-bold font-mono">
                    {pendingSent.length}
                  </span>
                </h4>
                {pendingSent.length === 0 ? (
                  <div className="text-center py-5 bg-zinc-900/10 rounded-2xl border border-zinc-900">
                    <p className="text-[10px] text-zinc-500 font-semibold">No outgoing pending requests.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {pendingSent.map(req => (
                      <div key={req.username} className="flex justify-between items-center bg-zinc-900/20 border border-zinc-900 p-3.5 rounded-2xl text-left">
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
                          <span className="text-[9px] font-mono uppercase bg-zinc-900 text-zinc-500 border border-zinc-800 px-2 py-0.5 rounded-full font-bold">
                            Pending
                          </span>
                          <button
                            onClick={() => handleRespondRequest(req.username, false)}
                            className="p-1 bg-rose-950/40 hover:bg-rose-900/40 text-rose-400 rounded-lg transition cursor-pointer"
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
          ) : (
            /* Tab Content: My Class Buddies */
            <div className="space-y-6">
              {/* Active Friends List */}
              <div className="space-y-3">
                <h4 className="text-xs font-mono font-black uppercase tracking-wider text-zinc-500">
                  My Class Buddies ({acceptedFriends.length})
                </h4>

                {isLoadingList ? (
                  <div className="text-center py-8">
                    <RefreshCw className="w-6 h-6 animate-spin text-zinc-700 mx-auto" />
                    <p className="text-[10px] text-zinc-550 mt-2">Loading friends list...</p>
                  </div>
                ) : acceptedFriends.length === 0 ? (
                  <div className="text-center py-10 bg-zinc-900/20 rounded-3xl border border-zinc-900">
                    <Users className="w-8 h-8 text-zinc-700 mx-auto mb-2" />
                    <p className="text-xs font-bold text-zinc-300 font-display">No buddies added yet</p>
                    <p className="text-[10px] text-zinc-550 mt-1">Switch to the "Suggested Bunkmates" tab to find buddies!</p>
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
      </motion.div>

      {/* Full Screen Friend Profile Modal Overlay */}
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

// Child Friend Card component for gated stats display
function FriendCard({ 
  friend, 
  onSelect 
}: { 
  friend: FriendItem; 
  onSelect: () => void; 
}) {
  const [stats, setStats] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);

  const loadStats = async (force = false, silent = false) => {
    if (!force && (stats || isLoading)) return;
    try {
      if (!silent) setIsLoading(true);
      const today = new Date();
      const clientDayOfWeek = today.getDay();
      const tzOffset = today.getTimezoneOffset() * 60000;
      const clientLocalDate = new Date(today.getTime() - tzOffset).toISOString().split('T')[0];

      const data = await friendsService.getStats(friend.username, clientLocalDate, clientDayOfWeek);
      if (data.success) {
        setStats(data);
      }
    } catch (err: any) {
      console.error(err);
    } finally {
      if (!silent) setIsLoading(false);
    }
  };

  useEffect(() => {
    loadStats(false, true);
  }, [friend.username]);

  useEffect(() => {
    // Real-time SSE updates subscription
    const unsubscribe = syncService.subscribeToUserUpdates((updatedUserId, updatedUsername) => {
      const match = (stats && stats.userId === updatedUserId) || 
                    (updatedUsername && friend.username.toLowerCase() === updatedUsername.toLowerCase());
      if (match) {
        loadStats(true, true);
      }
    });

    return () => {
      unsubscribe();
    };
  }, [stats, friend.username]);

  const getAttendanceColor = (pct: number) => {
    if (pct >= 85) return { text: 'text-emerald-400', border: 'border-emerald-500/20', bg: 'bg-emerald-500/10', ring: '#10b981' };
    if (pct >= 75) return { text: 'text-indigo-400', border: 'border-indigo-500/20', bg: 'bg-indigo-500/10', ring: '#6366f1' };
    return { text: 'text-rose-400', border: 'border-rose-500/20', bg: 'bg-rose-500/10', ring: '#ef4444' };
  };

  const colorMeta = stats ? getAttendanceColor(stats.overallPercentage) : { text: 'text-zinc-550', border: 'border-zinc-800', bg: 'bg-zinc-900', ring: '#52525b' };

  return (
    <div 
      onClick={onSelect}
      className="bg-zinc-900/50 border border-zinc-850 rounded-2xl p-4 shadow-sm hover:bg-zinc-900 hover:shadow-md transition-all duration-200 cursor-pointer flex flex-col space-y-3 text-white"
    >
      <div className="flex justify-between items-center">
        <div className="flex items-center space-x-3 text-left">
          {/* Large Avatar with Online status indicator dot */}
          <div className="relative shrink-0">
            {renderAvatar(stats?.avatarId || friend.avatarId || undefined, stats?.displayName || friend.displayName || friend.username, 'w-11 h-11 text-lg')}
            <span className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-zinc-950 ${
              friend.isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-zinc-600'
            }`} />
          </div>
          <div className="text-left">
            <span className="block text-xs font-black text-white leading-tight">
              {stats?.displayName || friend.displayName || friend.username}
            </span>
            <span className="block text-[10px] text-zinc-500 font-bold mt-0.5">
              @{friend.username}
            </span>
          </div>
        </div>

        {/* Small progress ring & Attendance % */}
        <div className="flex items-center space-x-2">
          {stats ? (
            <div className="flex items-center space-x-2 bg-zinc-950 border border-zinc-850 py-1.5 px-2.5 rounded-xl">
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
            <div className="bg-zinc-950/40 p-1.5 rounded-xl border border-zinc-850">
              <span className="block text-[8px] font-black text-zinc-500 uppercase">Streak</span>
              <span className="text-[10px] font-mono font-black text-amber-500">
                🔥 {stats.currentStreak || 0}d
              </span>
            </div>
            <div className="bg-zinc-950/40 p-1.5 rounded-xl border border-zinc-850">
              <span className="block text-[8px] font-black text-zinc-500 uppercase">Today</span>
              <span className="text-[10px] font-mono font-black text-indigo-400">
                {stats.todaySchedule ? `${stats.todaySchedule.length} cls` : '0 cls'}
              </span>
            </div>
            <div className="bg-zinc-950/40 p-1.5 rounded-xl border border-zinc-850">
              <span className="block text-[8px] font-black text-zinc-500 uppercase">Synced</span>
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
