/* assets/js/realtime.js
 * 用 Supabase Realtime 替代“手动刷新”。
 *
 * 思路：
 *   订阅 dungeons / comments / ratings 三张“公开可读”表的变更；
 *   收到变更后只做「去抖动的缓存失效 + 局部重渲染」，不整页刷新。
 *   页面切到后台标签(不可见)时自动退订，回到前台再补一次刷新。
 *
 * 依赖：foundation.js 已创建全局 supabaseClient（未启用本地回退时为 null）。
 * 说明：这三张表均已启用 RLS 且带有公开 SELECT 策略，
 *       anon 客户端可通过 postgres_changes 收到变更（见配套 SQL 迁移）。
 */
(function () {
  'use strict';

  const TABLES = ['dungeons', 'comments', 'ratings'];
  const DEBOUNCE_MS = 500;

  // —— 客户端解析：优先复用 foundation.js 里的全局客户端 —— //
  function resolveClient() {
    try {
      if (typeof supabaseClient !== 'undefined' && supabaseClient && supabaseClient.channel) {
        return supabaseClient;
      }
    } catch (_) { /* supabaseClient 未定义 */ }
    if (window.supabaseClient && window.supabaseClient.channel) return window.supabaseClient;
    if (
      window.supabase && typeof window.supabase.createClient === 'function' &&
      typeof SUPABASE_URL !== 'undefined' && typeof SUPABASE_ANON_KEY !== 'undefined'
    ) {
      try { return window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY); } catch (_) {}
    }
    return null;
  }

  // —— 供页面/模块注册自定义回调 —— //
  const listeners = {}; // table -> [cb]

  function on(table, cb) {
    if (typeof cb !== 'function') return function () {};
    (listeners[table] || (listeners[table] = [])).push(cb);
    return function off() {
      listeners[table] = (listeners[table] || []).filter(function (fn) { return fn !== cb; });
    };
  }

  function callIfPresent(name) {
    const fn = window[name];
    if (typeof fn === 'function') {
      try { return fn.apply(window, Array.prototype.slice.call(arguments, 1)); }
      catch (e) { console.warn('[realtime] 调用 ' + name + ' 失败：', e); }
    }
  }

  function invalidateCaches(scope) {
    if (scope === 'dungeon' || scope === 'all') callIfPresent('invalidateDungeonListCache');
    if (scope === 'short' || scope === 'dungeon' || scope === 'all') callIfPresent('invalidateShortReadCache');
  }

  // —— 每张表的默认刷新动作（只刷新当前可见视图）—— //
  const DEFAULT_REFRESH = {
    dungeons: function () {
      invalidateCaches('dungeon');
      callIfPresent('renderDungeonList');
      callIfPresent('refreshMatchStateUI');
      callIfPresent('refreshMatchDetailPanel');
    },
    comments: function () {
      invalidateCaches('short');
      callIfPresent('renderLatestComments');
    },
    ratings: function () {
      invalidateCaches('short');
      callIfPresent('renderDungeonList');
      callIfPresent('refreshMatchDetailPanel');
    }
  };

  // —— 去抖动调度 —— //
  const pending = new Set();
  let timer = null;

  function schedule(table) {
    if (table) pending.add(table);
    else TABLES.forEach(function (t) { pending.add(t); });
    if (timer) return;
    timer = setTimeout(function () {
      timer = null;
      const tables = Array.from(pending);
      pending.clear();
      tables.forEach(function (t) {
        try { (DEFAULT_REFRESH[t] || function () {})(); }
        catch (e) { console.warn('[realtime] 刷新 ' + t + ' 失败：', e); }
        (listeners[t] || []).forEach(function (cb) {
          try { cb(); } catch (e) { console.warn('[realtime] 回调失败：', e); }
        });
      });
      document.dispatchEvent(new CustomEvent('fog:realtime-refresh', { detail: { tables: tables } }));
    }, DEBOUNCE_MS);
  }

  // —— 订阅生命周期 —— //
  let client = null;
  let channel = null;
  let paused = false;

  function subscribe() {
    if (channel) return;
    client = client || resolveClient();
    if (!client) {
      console.info('[realtime] 未找到 Supabase 客户端，跳过实时订阅（本地回退模式）。');
      return;
    }
    channel = client.channel('fog-dungeon-live');
    TABLES.forEach(function (table) {
      channel.on('postgres_changes', { event: '*', schema: 'public', table: table }, function () {
        schedule(table);
      });
    });
    channel.subscribe(function (status) {
      if (status === 'SUBSCRIBED') console.info('[realtime] 已连接，实时更新已开启。');
      else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        console.warn('[realtime] 连接异常：' + status + '（稍后自动重连）。');
      }
    });
  }

  function pause() {
    if (paused) return;
    paused = true;
    if (channel) { try { channel.unsubscribe(); } catch (_) {} channel = null; }
  }

  function resume() {
    if (!paused) return;
    paused = false;
    subscribe();
    schedule(null); // 回到前台补一次刷新
  }

  function handleVisibility() {
    if (document.hidden) pause(); else resume();
  }

  function init() {
    if (document.hidden) paused = true; else subscribe();
    document.addEventListener('visibilitychange', handleVisibility);
  }

  window.FogRealtime = {
    on: on,
    refreshNow: schedule,
    pause: pause,
    resume: resume,
    init: init,
    isActive: function () { return !!channel; }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
