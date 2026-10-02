<script setup lang="ts">
// 顶部通知铃铛：同批次冻结/解封/风险提醒/申请取消等站内消息（演示环境模拟短信/公众号通知）
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useMedkitStore } from '@/stores/medkit'
import { fmtDateTime } from '@/utils/date'

const store = useMedkitStore()
const router = useRouter()
const open = ref(false)

const KIND_ICON: Record<string, string> = {
  batch_frozen: '🧊',
  batch_resolved: '🔓',
  risk_warning: '🟡',
  request_cancelled: '❌',
  general: '🔔',
}

function toggle() {
  open.value = !open.value
}
function readAll() {
  store.markAllNotificationsRead()
}
function go(itemIds?: string[]) {
  open.value = false
  if (itemIds?.length) router.push(`/items/${itemIds[0]}`)
}
</script>

<template>
  <div class="bell-wrap">
    <button type="button" class="bell-btn" :class="{ active: open }" @click="toggle">
      🔔<span v-if="store.unreadCount" class="bell-dot">{{ store.unreadCount > 9 ? '9+' : store.unreadCount }}</span>
    </button>

    <div v-if="open" class="bell-panel">
      <div class="bell-head">
        <strong>消息通知</strong>
        <button type="button" class="btn btn-sm" @click="readAll">全部已读</button>
      </div>
      <div v-if="!store.myNotifications.length" class="bell-empty">暂无通知</div>
      <div
        v-for="n in store.myNotifications"
        :key="n.id"
        class="bell-item"
        :class="{ unread: !n.read }"
        role="button"
        tabindex="0"
        @click="go(n.itemIds)"
        @keydown.enter="go(n.itemIds)"
      >
        <div class="bi-title">
          <span>{{ KIND_ICON[n.kind] ?? '🔔' }}</span>
          <strong>{{ n.title }}</strong>
          <span v-if="!n.read" class="unread-dot" />
        </div>
        <div class="bi-body">{{ n.body }}</div>
        <div class="bi-time">{{ fmtDateTime(n.at) }}</div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.bell-wrap {
  position: relative;
}
.bell-btn {
  position: relative;
  border: none;
  background: rgba(255, 255, 255, 0.18);
  color: #fff;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  font-size: 1.05rem;
  cursor: pointer;
}
.bell-btn.active,
.bell-btn:hover {
  background: rgba(255, 255, 255, 0.3);
}
.bell-dot {
  position: absolute;
  top: -4px;
  right: -4px;
  background: var(--c-danger);
  color: #fff;
  border-radius: 999px;
  font-size: 0.66rem;
  font-weight: 700;
  padding: 1px 5px;
  line-height: 1.3;
}
.bell-panel {
  position: absolute;
  right: 0;
  top: 44px;
  width: 360px;
  max-width: 86vw;
  max-height: 70vh;
  overflow-y: auto;
  background: #fff;
  color: var(--c-gray-900);
  border-radius: 12px;
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.18);
  z-index: 300;
  padding: 6px;
}
.bell-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 10px 4px;
}
.bell-empty {
  padding: 24px 10px;
  text-align: center;
  color: var(--c-gray-500);
  font-size: 0.88rem;
}
.bell-item {
  padding: 10px;
  border-radius: 10px;
  cursor: pointer;
  border-bottom: 1px solid var(--c-gray-100);
}
.bell-item:hover {
  background: var(--c-gray-100);
}
.bell-item.unread {
  background: var(--c-primary-soft);
}
.bi-title {
  display: flex;
  gap: 6px;
  align-items: center;
  font-size: 0.9rem;
}
.unread-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--c-danger);
  margin-left: auto;
}
.bi-body {
  font-size: 0.82rem;
  color: var(--c-gray-700);
  margin: 4px 0 2px;
}
.bi-time {
  font-size: 0.74rem;
  color: var(--c-gray-500);
}
</style>
