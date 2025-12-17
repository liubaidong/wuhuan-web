<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { NButton, NCard, NInput, NSelect, NImage, NGrid, NGridItem, useMessage, NModal, NSpin, NProgress } from 'naive-ui'
import { SvgIcon } from '@/components/common'
import { useBasicLayout } from '@/hooks/useBasicLayout'
import { t } from '@/locales'
import { upImg, lumaFetch, FeedLumaTask, mlog } from '@/api'
import { homeStore } from '@/store'
import { lumaStore, LumaMedia } from '@/api/lumaStore'
import { ss } from '@/utils/storage'

const { isMobile } = useBasicLayout()
const message = useMessage()
const lumaS = new lumaStore()

// 状态管理
const prompt = ref('')
const loading = ref(false)
const selectedAspectRatio = ref('16:9')
const selectedDuration = ref('5')
const expandPrompt = ref(true)
const uploadedImage = ref('')
const generatedVideos = ref<LumaMedia[]>([])
const showVideoModal = ref(false)
const selectedVideo = ref('')
const processingTasks = ref<Set<string>>(new Set())

// 宽高比选项
const aspectRatios = [
  { label: '16:9', value: '16:9', icon: 'mdi:monitor' },
  { label: '9:16', value: '9:16', icon: 'mdi:cellphone' },
  { label: '1:1', value: '1:1', icon: 'mdi:square' },
  { label: '4:5', value: '4:5', icon: 'mdi:tablet' },
]

// 时长选项
const durationOptions = [
  { label: '5秒', value: '5' },
  { label: '10秒', value: '10' },
  { label: '15秒', value: '15' },
  { label: '30秒', value: '30' },
]

// 图片上传处理
const fileRef = ref<HTMLInputElement>()
const handleFileSelect = async (file: File) => {
  try {
    const result = await upImg(file)
    if (result?.url) {
      uploadedImage.value = result.url
      message.success('图片上传成功')
    }
  } catch (error: any) {
    message.error(error?.message || '图片上传失败')
  }
  return false
}

// 生成视频
const generateVideo = async () => {
  if (!prompt.value.trim()) {
    message.warning('请输入视频描述')
    return
  }

  loading.value = true
  try {
    const params = {
      user_prompt: prompt.value,
      aspect_ratio: selectedAspectRatio.value,
      expand_prompt: expandPrompt.value,
      image_url: uploadedImage.value || '',
    }

    // 调用后端API
    const response = await lumaFetch('/generations/', params)
    
    if (response) {
      const taskId = response.id || response[0]?.id
      if (taskId) {
        message.success('视频生成任务已提交，请稍候...')
        processingTasks.value.add(taskId)
        
        // 开始轮询任务状态
        FeedLumaTask(taskId)
        
        // 清空输入
        prompt.value = ''
        uploadedImage.value = ''
      }
    }
  } catch (error: any) {
    mlog('generateVideo error:', error)
    message.error(error?.message || '视频生成失败')
  } finally {
    loading.value = false
  }
}

// 查看视频
const viewVideo = (videoUrl: string) => {
  selectedVideo.value = videoUrl
  showVideoModal.value = true
}

// 删除上传的图片
const removeUploadedImage = () => {
  uploadedImage.value = ''
}

// 清空输入
const clearInput = () => {
  prompt.value = ''
  uploadedImage.value = ''
  expandPrompt.value = true
}

// 下载视频
const downloadVideo = (videoUrl: string) => {
  if (!videoUrl) {
    message.warning('视频尚未生成完成')
    return
  }
  try {
    const link = document.createElement('a')
    link.href = videoUrl
    link.download = `generated-video-${Date.now()}.mp4`
    link.target = '_blank'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    message.success('视频下载已开始')
  } catch (error) {
    message.error('视频下载失败')
  }
}

// 重新生成
const regenerateVideo = (id: string) => {
  processingTasks.value.add(id)
  FeedLumaTask(id)
  message.info('正在重新生成视频，请稍候...')
}

// 删除视频
const deleteVideo = (id: string) => {
  const arr = lumaS.getObjs()
  const filtered = arr.filter(v => v.id !== id)
  // 从存储中删除
  ss.set('luma-store', filtered)
  // 更新显示列表
  generatedVideos.value = filtered.reverse()
  processingTasks.value.delete(id)
  message.success('视频已删除')
}

// 加载已生成的视频
const loadGeneratedVideos = () => {
  const arr = lumaS.getObjs()
  generatedVideos.value = arr.reverse()
  
  // 检查是否有正在处理的任务
  generatedVideos.value.forEach((video) => {
    const hasVideoUrl = video.video?.download_url || video.video?.url
    if (video.state !== 'completed' && !hasVideoUrl) {
      processingTasks.value.add(video.id)
    } else if (video.state === 'completed' && hasVideoUrl) {
      processingTasks.value.delete(video.id)
    } else if (video.state === 'completed' && !hasVideoUrl) {
      // 如果状态是 completed 但没有视频链接，继续轮询
      processingTasks.value.add(video.id)
      FeedLumaTask(video.id)
    }
  })
}

// 监听任务更新
watch(
  () => homeStore.myData.act,
  (act) => {
    if (act === 'FeedLumaTask') {
      setTimeout(() => {
        loadGeneratedVideos()
      }, 500)
    }
  },
  { deep: true }
)

// 组件挂载时加载视频
onMounted(() => {
  loadGeneratedVideos()
})
</script>

<template>
  <div class="create-miracles-video-container h-full flex flex-col bg-gradient-to-br from-slate-50 via-purple-50 to-pink-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
    <!-- 头部 -->
    <div class="px-6 py-5 border-b border-gray-200/50 dark:border-gray-700/50 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm">
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-3xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
            创建视频奇迹
          </h1>
          <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">使用AI将图片转换为动态视频</p>
        </div>
        <div class="flex items-center gap-2">
          <SvgIcon icon="mdi:video" class="text-2xl text-purple-500" />
        </div>
      </div>
    </div>

    <div class="flex-1 overflow-hidden flex">
      <!-- 左侧：输入面板 -->
      <div class="w-[420px] border-r border-gray-200/50 dark:border-gray-700/50 bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm overflow-y-auto shadow-lg">
        <div class="p-6 space-y-6">
          <!-- 视频描述输入 -->
          <div>
            <label class="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
              <SvgIcon icon="mdi:text-box" class="text-purple-500" />
              视频描述
            </label>
            <NInput
              v-model:value="prompt"
              type="textarea"
              :placeholder="'描述你想要的视频效果，例如：一只猫咪在窗台上悠闲地晒太阳，微风吹动窗帘...'"
              :autosize="{ minRows: 5, maxRows: 10 }"
              class="w-full"
            />
            <p class="text-xs text-gray-400 dark:text-gray-500 mt-1">提示：描述越详细，生成的视频效果越好</p>
          </div>

          <!-- 宽高比选择 -->
          <div>
            <label class="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
              <SvgIcon icon="mdi:aspect-ratio" class="text-blue-500" />
              视频比例
            </label>
            <div class="grid grid-cols-4 gap-2">
              <div
                v-for="ratio in aspectRatios"
                :key="ratio.value"
                @click="selectedAspectRatio = ratio.value"
                :class="[
                  'aspect-ratio-item p-3 rounded-xl border-2 cursor-pointer transition-all transform hover:scale-105',
                  selectedAspectRatio === ratio.value
                    ? 'border-purple-500 bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/30 dark:to-pink-900/30 shadow-md'
                    : 'border-gray-200 dark:border-gray-700 hover:border-purple-300 dark:hover:border-purple-600 bg-white dark:bg-gray-700'
                ]"
              >
                <div class="flex flex-col items-center">
                  <SvgIcon 
                    :icon="ratio.icon" 
                    class="text-xl mb-1"
                    :class="selectedAspectRatio === ratio.value ? 'text-purple-600 dark:text-purple-400' : 'text-gray-500 dark:text-gray-400'"
                  />
                  <span 
                    class="text-xs font-medium"
                    :class="selectedAspectRatio === ratio.value ? 'text-purple-600 dark:text-purple-400' : 'text-gray-600 dark:text-gray-400'"
                  >
                    {{ ratio.label }}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <!-- 时长选择 -->
          <div>
            <label class="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
              <SvgIcon icon="mdi:clock-outline" class="text-orange-500" />
              视频时长
            </label>
            <NSelect
              v-model:value="selectedDuration"
              :options="durationOptions"
              placeholder="选择视频时长"
            />
          </div>

          <!-- 扩展提示词 -->
          <div class="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50">
            <div class="flex items-center gap-2">
              <SvgIcon icon="mdi:auto-fix" class="text-green-500" />
              <span class="text-sm font-medium text-gray-700 dark:text-gray-300">扩展提示词</span>
            </div>
            <NButton
              size="small"
              :type="expandPrompt ? 'primary' : 'default'"
              @click="expandPrompt = !expandPrompt"
            >
              {{ expandPrompt ? '开启' : '关闭' }}
            </NButton>
          </div>

          <!-- 参考图片上传 -->
          <div>
            <label class="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
              <SvgIcon icon="mdi:image-plus" class="text-pink-500" />
              参考图片（可选）
            </label>
            <input
              ref="fileRef"
              type="file"
              accept="image/*"
              style="display: none"
              @change="(e) => {
                const files = (e.target as HTMLInputElement).files;
                if (files && files[0]) {
                  handleFileSelect(files[0]);
                }
              }"
            />
            <NButton class="w-full" @click="fileRef?.click()">
              <template #icon>
                <SvgIcon icon="mdi:upload" />
              </template>
              上传参考图片
            </NButton>
            
            <!-- 已上传的图片预览 -->
            <div v-if="uploadedImage" class="mt-3 relative group">
              <img
                :src="uploadedImage"
                class="w-full h-40 object-cover rounded-lg"
                alt="Reference"
              />
              <button
                @click="removeUploadedImage"
                class="absolute top-2 right-2 opacity-0 group-hover:opacity-100 bg-red-500 text-white rounded-full p-2 transition-opacity"
              >
                <SvgIcon icon="mdi:close" class="text-sm" />
              </button>
            </div>
          </div>

          <!-- 操作按钮 -->
          <div class="flex gap-3 pt-2">
            <NButton
              type="primary"
              size="large"
              class="flex-1 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 shadow-lg"
              :loading="loading"
              @click="generateVideo"
            >
              <template #icon>
                <SvgIcon icon="mdi:video-plus" />
              </template>
              {{ loading ? '生成中...' : '生成视频' }}
            </NButton>
            <NButton
              size="large"
              secondary
              @click="clearInput"
            >
              <template #icon>
                <SvgIcon icon="mdi:refresh" />
              </template>
              清空
            </NButton>
          </div>
        </div>
      </div>

      <!-- 右侧：视频画廊 -->
      <div class="flex-1 overflow-y-auto p-6">
        <div v-if="generatedVideos.length === 0" class="h-full flex items-center justify-center">
          <div class="text-center max-w-md">
            <div class="mb-6">
              <SvgIcon icon="mdi:video-outline" class="text-8xl text-gray-300 dark:text-gray-600 mb-4 opacity-50" />
            </div>
            <h3 class="text-xl font-semibold text-gray-700 dark:text-gray-300 mb-2">还没有生成的视频</h3>
            <p class="text-sm text-gray-500 dark:text-gray-400 mb-4">输入描述并上传图片，点击生成按钮开始创作</p>
            <div class="flex flex-col gap-2 text-xs text-gray-400 dark:text-gray-500">
              <p>📝 描述你想要的视频效果</p>
              <p>🖼️ 上传参考图片（可选）</p>
              <p>🎬 选择视频比例和时长</p>
              <p>🚀 点击生成，等待奇迹</p>
            </div>
          </div>
        </div>

        <div v-else>
          <div class="mb-4 flex items-center justify-between">
            <h2 class="text-lg font-semibold text-gray-700 dark:text-gray-300">
              生成的视频 ({{ generatedVideos.length }})
            </h2>
          </div>
          <NGrid :cols="isMobile ? 1 : 3" :x-gap="20" :y-gap="20">
            <NGridItem
              v-for="video in generatedVideos"
              :key="video.id"
            >
              <NCard class="video-card hover:shadow-xl transition-all duration-300 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden bg-white dark:bg-gray-800 relative group">
                <!-- 关闭按钮 -->
                <button
                  @click.stop="deleteVideo(video.id)"
                  class="absolute top-2 right-2 z-10 opacity-0 group-hover:opacity-100 bg-red-500 hover:bg-red-600 text-white rounded-full p-1.5 transition-all duration-200 shadow-lg hover:shadow-xl flex items-center justify-center"
                  :class="{ 'opacity-100': isMobile }"
                  title="删除视频"
                >
                  <SvgIcon icon="mdi:close" class="text-base" />
                </button>
                
                <div 
                  @click="() => {
                    const url = video.video?.download_url || video.video?.url;
                    if (url) viewVideo(url);
                  }" 
                  class="relative cursor-pointer"
                >
                  <!-- 视频播放器 -->
                  <div class="relative aspect-[16/9] bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-700 dark:to-gray-800 rounded-t-lg overflow-hidden">
                    <video
                      v-if="video.video?.download_url || video.video?.url"
                      :src="video.video?.download_url || video.video?.url"
                      class="w-full h-full object-cover"
                      loop
                      muted
                      playsinline
                      preload="metadata"
                      @mouseenter="(e) => {
                        const videoEl = e.target as HTMLVideoElement;
                        videoEl.play().catch(() => {});
                      }"
                      @mouseleave="(e) => {
                        const videoEl = e.target as HTMLVideoElement;
                        videoEl.pause();
                        videoEl.currentTime = 0;
                      }"
                    />
                    <div v-else class="w-full h-full flex flex-col items-center justify-center">
                      <NSpin size="large" />
                      <p class="text-sm text-gray-500 dark:text-gray-400 mt-3">生成中...</p>
                      <p v-if="video.state" class="text-xs text-gray-400 dark:text-gray-500 mt-1">
                        状态: {{ video.state }}
                      </p>
                    </div>
                    
                    <!-- 播放按钮覆盖层 -->
                    <div 
                      v-if="video.video?.download_url || video.video?.url" 
                      class="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                    >
                      <div class="bg-white/20 backdrop-blur-sm rounded-full p-4">
                        <SvgIcon icon="mdi:play-circle" class="text-white text-5xl" />
                      </div>
                    </div>
                  </div>
                </div>
                <div class="p-4">
                  <p class="text-sm text-gray-700 dark:text-gray-300 line-clamp-2 mb-3 min-h-[2.5rem]">
                    {{ video.prompt || '无描述' }}
                  </p>
                  <div class="flex gap-2">
                    <NButton 
                      v-if="video.video?.download_url || video.video?.url"
                      size="small" 
                      quaternary 
                      class="flex-1"
                      @click.stop="downloadVideo(video.video?.download_url || video.video?.url || '')"
                    >
                      <template #icon>
                        <SvgIcon icon="mdi:download" />
                      </template>
                      下载
                    </NButton>
                    <NButton 
                      v-if="!video.video?.download_url && !video.video?.url"
                      size="small" 
                      type="primary"
                      class="flex-1"
                      @click.stop="regenerateVideo(video.id)"
                    >
                      <template #icon>
                        <SvgIcon icon="mdi:refresh" />
                      </template>
                      重新生成
                    </NButton>
                    <NButton 
                      v-if="video.video?.download_url || video.video?.url"
                      size="small" 
                      quaternary 
                      class="flex-1"
                      @click.stop="() => {
                        const url = video.video?.download_url || video.video?.url || '';
                        if (url) {
                          navigator.clipboard.writeText(url);
                          message.success('链接已复制到剪贴板');
                        }
                      }"
                    >
                      <template #icon>
                        <SvgIcon icon="mdi:share" />
                      </template>
                      分享
                    </NButton>
                  </div>
                </div>
              </NCard>
            </NGridItem>
          </NGrid>
        </div>
      </div>
    </div>

    <!-- 视频预览模态框 -->
    <NModal v-model:show="showVideoModal" preset="card" title="视频预览" style="max-width: 90vw;">
      <video
        v-if="selectedVideo"
        :src="selectedVideo"
        controls
        class="w-full"
        autoplay
      />
    </NModal>
  </div>
</template>

<style scoped>
.create-miracles-video-container {
  min-height: 100vh;
}

.aspect-ratio-item {
  transition: all 0.2s ease;
}

.video-card {
  overflow: hidden;
}

.video-card video {
  transition: transform 0.3s ease;
}

.video-card:hover video {
  transform: scale(1.05);
}
</style>

