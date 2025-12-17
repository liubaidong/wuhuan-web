<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import aiSiderInput from './aiSiderInput.vue'
import createMiracles from './createMiracles.vue'
import { useBasicLayout } from '@/hooks/useBasicLayout'
import { mlog } from '@/api'
import chatIndex from '@/views/chat/index.vue'
import { NButton } from 'naive-ui'
import { SvgIcon } from '@/components/common'

const { isMobile } = useBasicLayout()
const route = useRoute()
const router = useRouter()

const isCreateMiracles = computed(() => route.path.includes('create-miracles'))

const drawSent = (obj: any) => {
  mlog('drawSent', obj)
}

const mjClose = () => {
}

const goToCreateMiracles = () => {
  router.push('/draw/create-miracles')
}

const goToClassic = () => {
  router.push('/draw')
}
</script>
<template>
  <div class="flex h-full">
    <!-- 经典模式 -->
    <template v-if="!isCreateMiracles">
      <div class="h-full">
        <aiSiderInput @close="mjClose" @drawSent="drawSent" :button-disabled="false" />
      </div>
      <main class="flex-1 overflow-hidden h-full relative">
        <!-- 切换按钮 -->
        <div class="absolute top-4 right-4 z-10">
          <NButton type="primary" @click="goToCreateMiracles">
            <template #icon>
              <SvgIcon icon="mdi:sparkles" />
            </template>
            创建奇迹模式
          </NButton>
        </div>
        <chatIndex />
      </main>
    </template>

    <!-- 创建奇迹模式 -->
    <template v-else>
      <div class="absolute top-4 left-4 z-10">
        <NButton @click="goToClassic">
          <template #icon>
            <SvgIcon icon="mdi:arrow-left" />
          </template>
          返回经典模式
        </NButton>
      </div>
      <createMiracles />
    </template>
  </div>
</template>