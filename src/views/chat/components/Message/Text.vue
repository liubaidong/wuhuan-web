<script lang="ts" setup>
import { computed, onMounted, onUnmounted, onUpdated, ref } from 'vue'
import MarkdownIt from 'markdown-it'
import mdKatex from '@traptitech/markdown-it-katex'
import mila from 'markdown-it-link-attributes'
import hljs from 'highlight.js'
import { NImage } from 'naive-ui'
import { useBasicLayout } from '@/hooks/useBasicLayout'
import { t } from '@/locales'
import { copyToClip } from '@/utils/copy'

import mjText from '@/views/mj/mjText.vue'
import dallText from '@/views/mj/dallText.vue'
import ttsText from '@/views/mj/ttsText.vue'
import whisperText from '@/views/mj/whisperText.vue'
import MjTextAttr from '@/views/mj/mjTextAttr.vue'
import aiTextSetting from '@/views/mj/aiTextSetting.vue'
import aiSetAuth from '@/views/mj/aiSetAuth.vue'
import { isApikeyError, isAuthSessionError, isTTS } from '@/api'

interface Props {
  inversion?: boolean
  error?: boolean
  text?: string
  loading?: boolean
  asRawText?: boolean
  chat: Chat.Chat
}

const props = defineProps<Props>()

const { isMobile } = useBasicLayout()

const textRef = ref<HTMLElement>()

const mdi = new MarkdownIt({
  html: false,
  linkify: true,
  breaks: true,
  highlight(code, language) {
    const validLang = !!(language && hljs.getLanguage(language))
    if (validLang) {
      const lang = language ?? ''
      return highlightBlock(hljs.highlight(code, { language: lang }).value, lang)
    }
    return highlightBlock(hljs.highlightAuto(code).value, '')
  },
})

mdi.use(mila, { attrs: { target: '_blank', rel: 'noopener' } })
mdi.use(mdKatex, { blockClass: 'katexmath-block rounded-md p-[10px]', errorColor: ' #cc0000' })

const wrapClass = computed(() => {
  return [
    'text-wrap',
    'min-w-[20px]', 'max-w-[810px]',
    'rounded-md',
    isMobile.value ? 'p-2' : 'px-3 pb-2',
    props.inversion ? 'bg-[#d2f9d1]' : 'bg-[#f4f6f8]',
    props.inversion ? 'dark:bg-[#a1dc95]' : 'dark:bg-[#1e1e20]',
    props.inversion ? 'message-request' : 'message-reply',
    { 'text-red-500': props.error },
  ]
})

// 提取Markdown格式的图片URL
const extractedImages = computed(() => {
  const value = props.text ?? ''
  // 匹配Markdown图片格式: ![image](url) 或 ![alt](url)
  const imageRegex = /!\[([^\]]*)\]\(([^)]+)\)/g
  const images: string[] = []
  let match = imageRegex.exec(value)

  while (match !== null) {
    const imageUrl = match[2]
    // 验证是否为有效的URL
    if (imageUrl && (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')))
      images.push(imageUrl)

    match = imageRegex.exec(value)
  }

  return images
})

const text = computed(() => {
  let value = props.text ?? ''
  if (!props.asRawText) {
    // 处理后端返回内容中的转义换行，确保展示换行
    value = value.replaceAll('\\r\\n', '\n')
    value = value.replaceAll('\\n', '\n')
    value = value.replace(/\\\( *(.*?) *\\\)/g, '$$$1$$')
    // value = value.replace(/\\\((.*?)\\\)/g, '$$$1$$');
    value = value.replace(/\\\[ *(.*?) *\\\]/g, '$$$$$1$$$$')
    //
    value = value.replaceAll('\\[', '$$$$')
    value = value.replaceAll('\\]', '$$$$')

    // 思考过程处理
    // value= value.replace(/<think>([\s\S]*?)<\/think>/g, (match: string, content: string) => {
    value = value.replace(/<think>([\s\S]*?)(?=<\/think>|$)/g, (match: string, content: string) => {
      const processedContent: string = content
        .split('\n')
        .map(line => line.trim() ? `>${line}` : line)
        .join('\n').replace(/(\r?\n)+/g, '\n>\n')

      return `>Thinking...${processedContent}`
    })
    value = value.replaceAll('</think>', '')
    // mlog('replace', value)
    return mdi.render(value)
  }
  return value
})

function highlightBlock(str: string, lang?: string) {
  // 默认折叠代码块，点击小三角展开/收起
  return `<pre class="code-block-wrapper code-block-wrapper--collapsed"><div class="code-block-header"><span class="code-block-header__toggle">▶</span><span class="code-block-header__lang">${lang}</span><span class="code-block-header__copy">${t('chat.copyCode')}</span></div><code class="hljs code-block-body ${lang}">${str}</code></pre>`
}

function addCopyEvents() {
  if (!textRef.value) return

  // 复制代码
  const copyBtn = textRef.value.querySelectorAll('.code-block-header__copy')
  copyBtn.forEach((btn) => {
    btn.addEventListener('click', () => {
      const code = btn.parentElement?.nextElementSibling?.textContent
      if (code) {
        copyToClip(code).then(() => {
          btn.textContent = '复制成功'
          setTimeout(() => {
            btn.textContent = '复制代码'
          }, 1000)
        })
      }
    })
  })

  // 折叠/展开代码块
  const toggleBtn = textRef.value.querySelectorAll('.code-block-header__toggle')
  toggleBtn.forEach((btn) => {
    btn.addEventListener('click', () => {
      const header = btn.parentElement as HTMLElement | null
      const wrapper = header?.parentElement as HTMLElement | null
      if (!wrapper) return
      const isCollapsed = wrapper.classList.contains('code-block-wrapper--collapsed')
      if (isCollapsed) {
        wrapper.classList.remove('code-block-wrapper--collapsed')
        btn.textContent = '▼'
      } else {
        wrapper.classList.add('code-block-wrapper--collapsed')
        btn.textContent = '▶'
      }
    })
  })
}

function removeCopyEvents() {
  if (!textRef.value) return
  // 简单清理：直接克隆节点以移除事件监听
  const blocks = textRef.value.querySelectorAll('.code-block-wrapper')
  blocks.forEach((block) => {
    const newBlock = block.cloneNode(true)
    block.parentNode?.replaceChild(newBlock, block)
  })
}

onMounted(() => {
  addCopyEvents()
})

onUpdated(() => {
  addCopyEvents()
})

onUnmounted(() => {
  removeCopyEvents()
})
</script>

<template>
  <div class="text-black" :class="wrapClass">
    <div ref="textRef" class="leading-relaxed break-words">
      <div v-if="!inversion">
        <aiTextSetting v-if="!inversion && isApikeyError(text)" />
        <aiSetAuth v-if="!inversion && isAuthSessionError(text)" />

        <dallText v-if="chat.model && chat.model?.indexOf('chat') === -1" :chat="chat" class="whitespace-pre-wrap" />
        <mjText v-if="chat.mjID" class="whitespace-pre-wrap" :chat="chat" :mdi="mdi" />
        <ttsText v-else-if="chat.model && isTTS(chat.model) && chat.text === 'ok'" :chat="chat" />
        <template v-else>
          <div v-if="!asRawText" class="markdown-body" :class="{ 'markdown-body-generate': loading }" v-html="text" />
          <div v-else class="whitespace-pre-wrap" v-text="text" />
        </template>
        <!-- 显示从Markdown内容中提取的图片 -->
        <div v-if="extractedImages.length > 0" class="mt-3 flex flex-wrap gap-2">
          <div v-for="(imgUrl, index) in extractedImages" :key="index" class="relative">
            <NImage
              :src="imgUrl"
              preview
              class="rounded border border-gray-200 cursor-pointer hover:opacity-80 transition-opacity"
              :class="[extractedImages.length <= 1 ? 'max-w-[500px]' : 'w-[200px]']"
              :alt="`图片 ${index + 1}`"
            >
              <template #placeholder>
                <div class="w-full h-full flex items-center justify-center text-neutral-500 bg-gray-100">
                  <span>加载中...</span>
                </div>
              </template>
            </NImage>
          </div>
        </div>
      </div>
      <whisperText v-else-if="text === 'whisper' && chat.opt?.lkey" :chat="chat" />
      <div v-else-if="asRawText" class="whitespace-pre-wrap" v-text="text" />
      <div v-else class="markdown-body" style="--color-fg-default:#24292f" v-html="text" />
      <!-- <div v-else class="whitespace-pre-wrap" v-text="text" /> -->
      <!-- 显示从Markdown内容中提取的图片（用户消息） -->
      <div v-if="extractedImages.length > 0 && inversion" class="mt-3 flex flex-wrap gap-2">
        <div v-for="(imgUrl, index) in extractedImages" :key="index" class="relative">
          <NImage
            :src="imgUrl"
            preview
            class="rounded border border-gray-200 cursor-pointer hover:opacity-80 transition-opacity"
            :class="[extractedImages.length <= 1 ? 'max-w-[500px]' : 'w-[200px]']"
            :alt="`图片 ${index + 1}`"
          >
            <template #placeholder>
              <div class="w-full h-full flex items-center justify-center text-neutral-500 bg-gray-100">
                <span>加载中...</span>
              </div>
            </template>
          </NImage>
        </div>
      </div>
      <MjTextAttr v-if="chat.opt?.images" :image="chat.opt?.images[0]" />
      <whisperText v-if="chat.model && chat.model.indexOf('whisper') > -1 && chat.opt?.lkey" :is-w="true" :chat="chat" class="w-full" />
      <ttsText v-if="!inversion && chat.opt?.duration && chat.opt?.duration > 0 && chat.opt?.lkey" :is-w="true" :chat="chat" class="w-full" />
    </div>
  </div>
</template>

<style lang="less">
@import url(./style.less);
</style>
