<script setup lang="ts">
import { computed, defineAsyncComponent, ref, onMounted, Component, h } from "vue";
import { PromptStore, SvgIcon, ConsumptionRecord } from '@/components/common'
import { useBasicLayout } from '@/hooks/useBasicLayout'
const { isMobile } = useBasicLayout()
import { removeToken } from '@/store/modules/auth/helper'
import { NTooltip, NAvatar, NPopover, NMenu, NIcon } from 'naive-ui'

import { loginOut, getUserInfo } from '@/api/user'
import defaultAvatar from '@/assets/avatar.jpg'

import { defaultSetting, UserInfo } from '@/store/modules/user/helper'
import { useRouter } from 'vue-router'
import { getToken } from "@/store/modules/auth/helper";
import to from "await-to-js";
import {
  Settings as settings,
  Storefront as storefront,
  LogOut as out,
  ReceiptOutline as receipt
} from '@vicons/ionicons5'
import { useChatStore, useUserStore } from '@/store'


const Setting = defineAsyncComponent(() => import('@/components/common/Setting/index.vue'))

const st = ref({ 'show': false, showImg: false, menu: [], active: 'chat' })
const router1 = useRouter()
const userStore = useUserStore()
const userInfo = computed(() => userStore.userInfo)

const show = ref(false)
const showConsumptionRecord = ref(false)
const urouter = useRouter() //
const isLogin = computed(() => {
  return localStorage.getItem('TOKEN')
});

// 当前激活的会话 ID，用于从任意页面跳转回对应的对话页
const chatStore = useChatStore()
const activeChatUuid = computed(() => {
  // 优先使用当前激活会话，其次使用第一个历史会话，最后兜底为 1002
  if (chatStore.active)
    return chatStore.active
  if (chatStore.history.length > 0)
    return chatStore.history[0].uuid
  return 1002
})

function goChat() {
  st.value.active = 'chat'
  const uuid = activeChatUuid.value
  urouter.push({ name: 'Chat', params: { uuid } })
}

import { router } from '@/router'

const goHome = computed(() => {
  return router.currentRoute.value.name
});

onMounted(() => {
  getLoginUserInfo();
});


/**
 * 获取当前登录用户信息
 */
async function getLoginUserInfo() {
  // 用户未登录,不需要获取用户信息
  if (!getToken()) {
    return
  }
  const [err, newUserInfo] = await to(getUserInfo());
  if (err) {
    // message.error(err.toString())
    console.log(err.toString())
  }
  if (newUserInfo) {
    // 更新 userStore 中的用户信息
    userStore.updateUserInfo({
      avatar: newUserInfo.data.user.avatar || userInfo.value.avatar,
      name: newUserInfo.data.user.nickName,
      userBalance: newUserInfo.data.user.userBalance,
      userName: newUserInfo.data.user.userName
    })
  }
}

async function handleReset() {
  await loginOut()
  // 删除用户token
  removeToken();
  // 跳转到登录页面
  router1.push('/login')
}

async function longin() {
  // 跳转到登录页面
  router1.push('/login')
}

function renderIcon(icon: Component) {
  return () => h(NIcon, null, { default: () => h(icon) })
}

const menuOptions = ref([
  {
    label: '账号设置',
    key: 'accountSettings',
    icon: renderIcon(settings)
  },
  {
    label: '消费记录查询',
    key: 'consumptionRecord',
    icon: renderIcon(receipt)
  },
  {
    label: '立即充值',
    key: 'buy',
    icon: renderIcon(storefront)
  },
  {
    label: '退出账号',
    key: 'logout',
    icon: renderIcon(out)
  }
])

const handleSelect = (key: string) => {
  if (key === 'accountSettings') {
    st.value.show = true
  } else if (key === 'consumptionRecord') {
    showConsumptionRecord.value = true
  } else if (key === 'logout') {
    handleReset()
  } else if (key === 'buy') {
    show.value = true
  }
}
</script>
<template>


  <div class="flex-shrink-0 w-[78px] z-[1000] h-full" v-if="!isMobile" data-tauri-drag-region>
    <div class="ai-sider-container">
      <div class="ai-sider-nav" data-tauri-drag-region>
        <a @click="goChat" class="ai-sider-item" :class="{ 'ai-sider-item--active': goHome === 'Chat' }">
          <n-tooltip placement="right" trigger="hover">
            <template #trigger>
              <div class="ai-sider-icon">
                <SvgIcon icon="ri:wechat-line" class="ai-sider-icon-inner" />
              </div>
            </template>
            对话
          </n-tooltip>
        </a>

        <a @click="urouter.push(`/knowledge`)" class="ai-sider-item" :class="{ 'ai-sider-item--active': goHome === 'Knowledge' }">
          <n-tooltip placement="right" trigger="hover">
            <template #trigger>
              <div class="ai-sider-icon">
                <SvgIcon icon="garden:knowledge-base-26" class="ai-sider-icon-inner" />
              </div>
            </template>
            知识库
          </n-tooltip>
        </a>

        <a @click="urouter.push(`/draw`)" class="ai-sider-item" :class="{ 'ai-sider-item--active': goHome === 'draw' }">
          <n-tooltip placement="right" trigger="hover">
            <template #trigger>
              <div class="ai-sider-icon">
                <SvgIcon icon="material-symbols:draw-rounded" class="ai-sider-icon-inner" />
              </div>
            </template>
            绘画
          </n-tooltip>
        </a>

        <a @click="urouter.push(`/music`)" class="ai-sider-item" :class="{ 'ai-sider-item--active': goHome === 'music' }">
          <n-tooltip placement="right" trigger="hover">
            <template #trigger>
              <div class="ai-sider-icon">
                <SvgIcon icon="mingcute:music-line" class="ai-sider-icon-inner" />
              </div>
            </template>
            音乐
          </n-tooltip>
        </a>

        <a @click="urouter.push(`/video`)" class="ai-sider-item" :class="{ 'ai-sider-item--active': goHome === 'video' }">
          <n-tooltip placement="right" trigger="hover">
            <template #trigger>
              <div class="ai-sider-icon">
                <SvgIcon icon="mynaui:video" class="ai-sider-icon-inner" />
              </div>
            </template>
            视频
          </n-tooltip>
        </a>

        <a @click="urouter.push(`/workflow`)" class="ai-sider-item" :class="{ 'ai-sider-item--active': goHome === 'Workflow' }">
          <n-tooltip placement="right" trigger="hover">
            <template #trigger>
              <div class="ai-sider-icon">
                <SvgIcon icon="carbon:workflow-automation" class="ai-sider-icon-inner" />
              </div>
            </template>
            工作流
          </n-tooltip>
        </a>

        <a @click="urouter.push(`/ppt`)" class="ai-sider-item" :class="{ 'ai-sider-item--active': goHome === 'ppt' }">
          <n-tooltip placement="right" trigger="hover">
            <template #trigger>
              <div class="ai-sider-icon">
                <SvgIcon icon="icon-park-outline:ppt" class="ai-sider-icon-inner" />
              </div>
            </template>
            PPT
          </n-tooltip>
        </a>
      </div>

      <div class="ai-sider-footer">
        <n-popover trigger="click" :show-arrow="false">
          <template #trigger>
            <n-avatar
              v-show="isLogin"
              size="large"
              round
              :src="userInfo.avatar"
              :fallback-src="defaultAvatar"
              class="ai-sider-avatar"
            />
          </template>
          <n-menu :options="menuOptions" @select="handleSelect" />
        </n-popover>

        <div v-show="!isLogin" class="user-bottom" @click="longin">
          <n-button tertiary type="info">
            登录
          </n-button>
        </div>
      </div>
    </div>
  </div>
  <Setting v-if="st.show" v-model:visible="st.show" />
  <PromptStore v-model:visible="show"></PromptStore>
  <ConsumptionRecord v-model:visible="showConsumptionRecord"></ConsumptionRecord>

</template>

<style scoped lang="less">
.ai-sider-container {
  height: 100%;
  padding: 16px 10px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  align-items: center;
  border-radius: 24px;
  background: radial-gradient(circle at top, #3b82f6 0, #1f2937 45%, #020617 100%);
  box-shadow:
    0 18px 45px rgba(15, 23, 42, 0.8),
    0 0 0 1px rgba(148, 163, 184, 0.2);
}

.ai-sider-nav {
  display: flex;
  flex-direction: column;
  gap: 14px;
  flex: 1;
  align-items: center;
}

.ai-sider-item {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  border-radius: 999px;
  background: linear-gradient(145deg, rgba(15, 23, 42, 0.9), rgba(15, 23, 42, 0.6));
  box-shadow:
    0 10px 25px rgba(15, 23, 42, 0.75),
    0 0 0 1px rgba(148, 163, 184, 0.25);
  cursor: pointer;
  transition:
    transform 0.18s ease-out,
    box-shadow 0.18s ease-out,
    background 0.18s ease-out,
    opacity 0.18s ease-out;
  opacity: 0.9;
}

.ai-sider-item:hover {
  transform: translateY(-2px) scale(1.04);
  opacity: 1;
  box-shadow:
    0 16px 35px rgba(15, 23, 42, 0.9),
    0 0 0 1px rgba(191, 219, 254, 0.55);
}

.ai-sider-item--active {
  background: radial-gradient(circle at 30% 0%, #38bdf8 0, #6366f1 35%, #0f172a 80%);
  box-shadow:
    0 18px 38px rgba(59, 130, 246, 0.85),
    0 0 0 1px rgba(191, 219, 254, 0.9);
}

.ai-sider-icon {
  width: 26px;
  height: 26px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.ai-sider-icon-inner {
  font-size: 22px;
  color: #e5e7eb;
}

.ai-sider-item--active .ai-sider-icon-inner {
  color: #f9fafb;
}

.ai-sider-footer {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
}

.ai-sider-avatar {
  box-shadow:
    0 10px 25px rgba(15, 23, 42, 0.85),
    0 0 0 2px rgba(191, 219, 254, 0.6);
  cursor: pointer;
}
</style>
