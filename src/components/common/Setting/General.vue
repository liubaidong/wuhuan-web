<script lang="ts" setup>
import { computed, ref } from 'vue'
import { NButton, NInput, NSelect, useMessage, NUpload, UploadFileInfo } from 'naive-ui'
import type { Language, Theme } from '@/store/modules/app/helper'
import { SvgIcon } from '@/components/common'
import { useAppStore, useUserStore } from '@/store'
import type { UserInfo } from '@/store/modules/user/helper'
import { getToken } from '@/store/modules/auth/helper'
import { t } from '@/locales'

const message = useMessage()
const appStore = useAppStore()
const userStore = useUserStore()



const ms = useMessage()

const theme = computed(() => appStore.theme)

const userInfo = computed(() => userStore.userInfo)

const name = ref(userInfo.value.name ?? '')




const language = computed({
  get() {
    return appStore.language
  },
  set(value: Language) {
    appStore.setLanguage(value)
  },
})

const themeOptions: { label: string; key: Theme; icon: string }[] = [
  {
    label: 'Auto',
    key: 'auto',
    icon: 'ri:contrast-line',
  },
  {
    label: 'Light',
    key: 'light',
    icon: 'ri:sun-foggy-line',
  },
  {
    label: 'Dark',
    key: 'dark',
    icon: 'ri:moon-foggy-line',
  },
]

const languageOptions: { label: string; key: Language; value: Language }[] = [
  { label: '简体中文', key: 'zh-CN', value: 'zh-CN' },
  { label: 'English', key: 'en-US', value: 'en-US' }
]

function updateUserInfo(options: Partial<UserInfo>) {
  userStore.updateUserInfo(options)
  ms.success(t('common.success'))
}

const fileList = computed(() => {
  const avatarUrl = userInfo.value.avatar || 'https://ruoyi-ai-1254149996.cos.ap-guangzhou.myqcloud.com/2025/05/24/727370b029b648ea968977085da2b20f.jpg'
  return [{
    id: 'avatar',
    name: '头像预览',
    status: 'finished' as const,
    url: avatarUrl
  }]
})

const token = getToken()
const headers = {
  Authorization: `Bearer ${token}`
}

function handleFinish({
  event
}: {
  file: UploadFileInfo
  event?: ProgressEvent
}) {
  try {
    const response = (event?.target as XMLHttpRequest).response
    let avatarUrl = response
    
    // 尝试解析 JSON 响应
    try {
      const jsonResponse = JSON.parse(response)
      if (jsonResponse.data && jsonResponse.data.avatar) {
        avatarUrl = jsonResponse.data.avatar
      } else if (jsonResponse.avatar) {
        avatarUrl = jsonResponse.avatar
      } else if (jsonResponse.url) {
        avatarUrl = jsonResponse.url
      } else if (jsonResponse.data && jsonResponse.data.url) {
        avatarUrl = jsonResponse.data.url
      }
    } catch (e) {
      // 如果不是 JSON，直接使用响应字符串
    }
    
    // 更新 userStore 中的头像（fileList 会自动响应更新）
    userStore.updateUserInfo({ avatar: avatarUrl })
    
    message.success('上传成功！')
  } catch (error) {
    console.error('头像上传处理失败:', error)
    message.error('头像上传处理失败')
  }
}

</script>

<template>
  <div class="p-4 space-y-5 min-h-[200px]">
    <div class="space-y-6">
      <div class="flex items-center space-x-4">
        <span class="flex-shrink-0 w-[100px]">{{ $t('setting.avatarLink') }}</span>
        <n-upload action="/api/system/user/edit/avatar"
          :max=1
          list-type="image-card"
          :file-list="fileList"
          :headers="headers" @finish="handleFinish">
          点击上传
        </n-upload>
      </div>

      <div class="flex items-center space-x-4">
        <span class="flex-shrink-0 w-[100px]">{{ $t('setting.name') }}</span>
        <div class="w-[200px]">
          <NInput v-model:value="name" placeholder="" />
        </div>
        <NButton size="tiny" text type="primary" @click="updateUserInfo({ name })">
          {{ $t('common.save') }}
        </NButton>
      </div>

      <div class="flex items-center space-x-4">
        <span class="flex-shrink-0 w-[100px]">{{ $t('setting.theme') }}</span>
        <div class="flex flex-wrap items-center gap-4">
          <template v-for="item of themeOptions" :key="item.key">
            <NButton
              size="small"
              :type="item.key === theme ? 'primary' : undefined"
              @click="appStore.setTheme(item.key)"
            >
              <template #icon>
                <SvgIcon :icon="item.icon" />
              </template>
            </NButton>
          </template>
        </div>
      </div>
      <div class="flex items-center space-x-4">
        <span class="flex-shrink-0 w-[100px]">{{ $t('setting.language') }}</span>
        <div class="flex flex-wrap items-center gap-4">
          <NSelect
            style="width: 140px"
            :value="language"
            :options="languageOptions"
            @update-value="value => appStore.setLanguage(value)"
          />
        </div>
      </div>

    </div>
  </div>
</template>
