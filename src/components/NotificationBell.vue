<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useMedkitStore } from '@/stores/medkit'
import { fmtDateTime } from '@/utils/date'
import type { Notice } from '@/types'

const store = useMedkitStore()
const router = useRouter()
const open = ref(false)
const panelEl = ref<HTMLElement | null>(null)

const notices = computed(() => store.myNotices)
const unread = computed(() => store.unreadCount)

const KIND_ICON: Record<Notice['kind'], string> = {
  quarantine: '🚧',
  request_cancelled: '❌',
  investigation: '🔍',
  risk_notice: '⚠️',
  system: '🔔',
}

function toggle() {
  open.value = !open.value
}
function readOne(n: Notice) {
  store.markNoticeRead(n.id)
}
function readAll() {
  store.markAllNoticesRead()
}
function go(n: Notice) {
  store.markNoticeRead(n.id)
  open.value = false
  if (n.itemId) router.push(`/items/${n.itemId}`)
}
function onDocClick(e: MouseEvent) {
  if (open.value && panelEl.value && !panelEl.value.contains(e.target as Node)) open.value = false
}
onMounted(() => document.addEventListener('click', onDocClick))
onBeforeUnmount(() => document.removeEventListener('click', onDocClick))
</script>

<template>
  <div ref="panelEl" class="notice-box">
    <button class="notice-btn" :class="{ 'has-unread': unread > 0 }" @click.stop="toggle">
      🔔<span v-if="unread" class="notice-dot">{{ unread > 99 ? '99+' : unread }}</span>
    </button>
    <div v-if="open" class="notice-panel" @click.stop>
      <div class="notice-head">
        <strong>消息通知</strong>
        <button class="btn btn-sm" :disabled="!unread" @click="readAll">全部标为已读</button>
      </div>
      <div v-if="!notices.length" class="empty" style="padding: 20px">暂无消息</div>
      <div class="notice-list">
        <div
          v-for="n in notices"
          :key="n.id"
          class="notice-item"
          :class="{ unread: !n.readBy.includes(store.currentUserId) }"
          @click="go(n)"
        >
          <div class="notice-title">
            <span aria-hidden="true">{{ KIND_ICON[n.kind] }}</span>
            <span>{{ n.title }}</span>
            <span v-if="!n.readBy.includes(store.currentUserId)" class="unread-dot" />
          </div>
          <div class="notice-body">{{ n.body }}</div>
          <div class="notice-time">
            {{ fmtDateTime(n.at) }}
            <button class="notice-link" @click.stop="readOne(n)">标为已读</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.notice-box {
  position: relative;
}
.notice-btn {
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
.notice-btn.has-unread {
  background: rgba(255, 255, 255, 0.32);
}
.notice-dot {
  position: absolute;
  top: -4px;
  right: -4px;
  background: var(--c-danger);
  color: #fff;
  border-radius: 999px;
  font-size: 0.68rem;
  font-weight: 700;
  padding: 0 5px;
  line-height: 16px;
  min-width: 16px;
}
.notice-panel {
  position: absolute;
  right: 0;
  top: 44px;
  width: 380px;
  max-width: 92vw;
  max-height: 70vh;
  overflow: hidden;
  background: #fff;
  color: var(--c-gray-900);
  border-radius: 12px;
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.18);
  z-index: 300;
  display: flex;
  flex-direction: column;
}
.notice-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 14px;
  border-bottom: 1px solid var(--c-gray-200);
}
.notice-list {
  overflow-y: auto;
}
.notice-item {
  padding: 10px 14px;
  border-bottom: 1px solid var(--c-gray-100);
  cursor: pointer;
}
.notice-item:hover {
  background: var(--c-gray-100);
}
.notice-item.unread {
  background: var(--c-primary-soft);
}
.notice-title {
  display: flex;
  gap: 6px;
  align-items: center;
  font-weight: 600;
  font-size: 0.9rem;
}
.unread-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--c-danger);
  margin-left: auto;
  flex: none;
}
.notice-body {
  font-size: 0.83rem;
  color: var(--c-gray-700);
  margin: 3px 0;
}
.notice-time {
  font-size: 0.75rem;
  color: var(--c-gray-500);
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.notice-link {
  border: none;
  background: none;
  color: var(--c-primary-dark);
  cursor: pointer;
  font-size: 0.75rem;
  padding: 0;
}
</style>
