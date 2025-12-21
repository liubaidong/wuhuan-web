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

	// 【新增】提取candidates中的图片URL，封装为独立函数提高复用性
	const extractImagesFromCandidates = (data: any, images: string[]) => {
		if (!data || !data.candidates || !Array.isArray(data.candidates)) return

		data.candidates.forEach((candidate: any) => {
			// 处理content.parts.inlineData结构
			const inlineData = candidate.content?.parts?.[0]?.inlineData
			if (inlineData && inlineData.data) {
				images.push(inlineData.data)
			}
			// 兼容其他可能的图片路径（如直接返回url字段）
			const imageUrl = candidate.content?.parts?.[0]?.url || candidate.imageUrl
			if (imageUrl) {
				images.push(imageUrl)
			}
		})
	}

	// 【关键修改】重构图片提取逻辑，修复嵌套JSON解析和数据结构匹配问题，支持流式数据动态提取
	const extractedImages = computed(() => {
		const value = props.text ?? ''
		const images: string[] = []

		// 1. 匹配Markdown图片格式: ![image](url) 或 ![alt](url)
		const imageRegex = /!\[([^\]]*)\]\(([^)]+)\)/g
		let match = imageRegex.exec(value)
		while (match !== null) {
			const imageUrl = match[2]
			if (imageUrl && (imageUrl.startsWith('http://') || imageUrl.startsWith('https://'))) {
				images.push(imageUrl)
			}
			match = imageRegex.exec(value)
		}

		// 2. 【流式优化】使用正则表达式直接匹配图片URL（即使JSON不完整或转义）
		// 改进：匹配转义和未转义的URL，支持完整HTTP/HTTPS URL
		// 策略：先尝试匹配 "data":"https://..." 格式（最常见）
		// 然后匹配转义格式 \"data\":\"https://...\"

		// 方法1: 匹配未转义的格式 "data":"https://..."
		const unescapedPattern = /"data"\s*:\s*"(https?:\/\/[^"]+)"/gi
		let urlMatch
		while ((urlMatch = unescapedPattern.exec(value)) !== null) {
			const imageUrl = urlMatch[1]
			if (imageUrl && (imageUrl.startsWith('http://') || imageUrl.startsWith('https://'))) {
				images.push(imageUrl)
			}
		}

		// 方法2: 匹配转义的格式 \"data\":\"https://...\" 或 "data":"https://..." 在转义字符串中
		// 这个正则匹配：\"data\":\" 后面跟着 https:// 开头的URL
		const escapedPattern = /(?:\\"|")data(?:\\"|")\s*:\s*(?:\\"|")(https?:\/\/[^"\\]+)/gi
		while ((urlMatch = escapedPattern.exec(value)) !== null) {
			const imageUrl = urlMatch[1]
			if (imageUrl) {
				// 清理可能的转义字符
				const cleanUrl = imageUrl.replace(/\\\//g, '/').replace(/\\\\/g, '\\')
				if (cleanUrl && (cleanUrl.startsWith('http://') || cleanUrl.startsWith('https://'))) {
					images.push(cleanUrl)
				}
			}
		}

		// 方法3: 直接匹配所有 https:// 开头的URL（作为后备方案）
		// 但只在包含 "data" 字段的上下文中
		if (value.includes('"data"') || value.includes('\\"data\\"')) {
			const directUrlPattern = /(https?:\/\/[^\s"\\]+)/gi
			while ((urlMatch = directUrlPattern.exec(value)) !== null) {
				const imageUrl = urlMatch[1]
				if (imageUrl && (imageUrl.startsWith('http://') || imageUrl.startsWith('https://'))) {
					// 清理转义字符
					const cleanUrl = imageUrl.replace(/\\\//g, '/').replace(/\\"/g, '"').replace(/\\\\/g, '\\')
					// 只添加看起来像图片URL的（包含常见图片域名或路径）
					if (cleanUrl.match(/\.(jpg|jpeg|png|gif|webp|bmp|svg)/i) || cleanUrl.includes('oss-cn-') || cleanUrl.includes('aliyuncs.com')) {
						images.push(cleanUrl)
					}
				}
			}
		}

		// 3. 解析包装格式的 JSON 响应（{code: 200, msg: "..."}）
		// 优先处理这种格式，因为这是最常见的API响应格式
		try {
			const wrapperData = JSON.parse(value.trim())
			if (wrapperData && typeof wrapperData.code === 'number' && wrapperData.code === 200 && wrapperData.msg) {
				// 处理msg为字符串或对象的情况
				let msgData: any
				if (typeof wrapperData.msg === 'string') {
					try {
						// 尝试解析msg字符串（可能是转义的JSON字符串）
						msgData = JSON.parse(wrapperData.msg)
					} catch (e) {
						// 如果解析失败，尝试从字符串中直接提取图片URL（使用正则）
						const msgUrlPatterns = [
							/\\?"data\\?"\s*:\s*\\?"(https?:\/\/[^"\\]+)\\?"/gi,
							/"data"\s*:\s*"(https?:\/\/[^"]+)"/gi,
						]
						msgUrlPatterns.forEach(pattern => {
							let msgUrlMatch
							while ((msgUrlMatch = pattern.exec(wrapperData.msg)) !== null) {
								const imageUrl = msgUrlMatch[1]
								if (imageUrl) {
									const cleanUrl = imageUrl
										.replace(/\\\//g, '/')
										.replace(/\\"/g, '"')
										.replace(/\\\\/g, '\\')
									if (cleanUrl && (cleanUrl.startsWith('http://') || cleanUrl.startsWith('https://'))) {
										images.push(cleanUrl)
									}
								}
							}
						})
						// 如果已经提取到图片，直接返回
						if (images.length > 0) {
							return Array.from(new Set(images)).filter(url => {
								return url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:')
							})
						}
					}
				} else {
					msgData = wrapperData.msg
				}

				// 【关键修复】递归提取图片URL
				if (msgData) {
					extractImagesFromCandidates(msgData, images)
				}
			}
		} catch (e) {
			// JSON不完整，尝试从原始文本中直接提取
			// 这种情况在流式数据中很常见
		}

		// 4. 解析直接的 JSON 格式的图片响应（不包含code包装）
		try {
			const jsonData = JSON.parse(value.trim())
			extractImagesFromCandidates(jsonData, images)
		} catch (e) {
			// 尝试匹配嵌入在文本中的JSON片段（即使不完整）
			try {
				// 匹配包含candidates的JSON片段
				const jsonMatch = value.match(/\{[\s\S]*"candidates"[\s\S]*\}/)
				if (jsonMatch) {
					try {
						const jsonData = JSON.parse(jsonMatch[0])
						extractImagesFromCandidates(jsonData, images)
					} catch (e2) {
						// JSON不完整，已经在步骤2中通过正则提取了
					}
				}
			} catch (e2) {
				// 解析失败，忽略
			}
		}

		// 去重并过滤有效图片URL
		return Array.from(new Set(images)).filter(url => {
			return url && (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:'))
		})
	})

	const text = computed(() => {
		let value = props.text ?? ''

		if (!props.asRawText) {
			value = value.replaceAll('\\r\\n', '\n')
			value = value.replaceAll('\\n', '\n')
			value = value.replace(/\\\( *(.*?) *\\\)/g, '$$$1$$')
			value = value.replace(/\\\[ *(.*?) *\\\]/g, '$$$$$1$$$$')
			value = value.replaceAll('\\[', '$$$$')
			value = value.replaceAll('\\]', '$$$$')

		// 思考过程处理
		value = value.replace(/<think>([\s\S]*?)(?=<\/think>|$)/g, (match: string, content: string) => {
			const processedContent: string = content
				.split('\n')
				.map(line => line.trim() ? `>${line}` : line)
				.join('\n').replace(/(\r?\n)+/g, '\n>\n')

			return `>Thinking...${processedContent}`
		})
		value = value.replaceAll('</think>', '')
		return mdi.render(value)
		}
		return value
	})

	function highlightBlock(str: string, lang?: string) {
		return `<pre class="code-block-wrapper code-block-wrapper--collapsed"><div class="code-block-header"><span class="code-block-header__toggle">▶</span><span class="code-block-header__lang">${lang}</span><span class="code-block-header__copy">${t('chat.copyCode')}</span></div><code class="hljs code-block-body ${lang}">${str}</code></pre>`
	}

	function addCopyEvents() {
		if (!textRef.value) return

		const copyBtn = textRef.value.querySelectorAll('.code-block-header__copy')
		copyBtn.forEach((btn) => {
			btn.addEventListener('click', () => {
				const code = btn.parentElement?.nextElementSibling?.textContent
				if (code) {
					copyToClip(code).then(() => {
						btn.textContent = '复制成功'
						setTimeout(() => {
							btn.textContent = t('chat.copyCode')
						}, 1000)
					})
				}
			})
		})

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
				<!-- 助手消息（非用户消息） -->
				<div v-if="!inversion">
					<aiTextSetting v-if="isApikeyError(text)" />
					<aiSetAuth v-if="isAuthSessionError(text)" />

					<dallText v-if="chat.model && chat.model?.indexOf('chat') === -1" :chat="chat" class="whitespace-pre-wrap" />
					<mjText v-if="chat.mjID" class="whitespace-pre-wrap" :chat="chat" :mdi="mdi" />
					<ttsText v-else-if="chat.model && isTTS(chat.model) && chat.text === 'ok'" :chat="chat" />
					<template v-else>
						<div v-if="!asRawText" class="markdown-body" :class="{ 'markdown-body-generate': loading }" v-html="text" />
						<div v-else class="whitespace-pre-wrap" v-text="text" />
					</template>
				</div>

				<!-- 用户消息（inversion为true） -->
				<whisperText v-else-if="text === 'whisper' && chat.opt?.lkey" :chat="chat" />
				<div v-else-if="asRawText" class="whitespace-pre-wrap" v-text="text" />
				<div v-else class="markdown-body" style="--color-fg-default:#24292f" v-html="text" />

				<!-- 【关键优化】合并图片展示逻辑，避免重复代码，支持动态加载 -->
				<div v-if="extractedImages.length > 0" class="mt-3 flex flex-wrap gap-2">
					<div v-for="(imgUrl, index) in extractedImages" :key="`img-${index}-${imgUrl}`" class="relative">
						<NImage
							:src="imgUrl"
							preview
							:lazy="false"
							class="rounded border border-gray-200 dark:border-gray-700 cursor-pointer hover:opacity-80 transition-opacity"
							:class="[extractedImages.length <= 1 ? 'max-w-[500px]' : 'w-[200px]']"
							:alt="`图片 ${index + 1}`"
							style="object-fit: contain;"
						>
							<template #placeholder>
								<div class="w-full h-full flex items-center justify-center text-neutral-500 bg-gray-100 dark:bg-gray-800 rounded">
									<span>加载中...</span>
								</div>
							</template>
							<template #error>
								<div class="w-full h-full flex items-center justify-center text-neutral-500 bg-gray-100 dark:bg-gray-800 rounded">
									<span>图片加载失败</span>
								</div>
							</template>
						</NImage>
					</div>
				</div>

				<!-- 其他组件 -->
				<MjTextAttr v-if="chat.opt?.images" :image="chat.opt?.images[0]" />
				<whisperText v-if="chat.model && chat.model.indexOf('whisper') > -1 && chat.opt?.lkey" :is-w="true" :chat="chat" class="w-full" />
				<ttsText v-if="!inversion && chat.opt?.duration && chat.opt?.duration > 0 && chat.opt?.lkey" :is-w="true" :chat="chat" class="w-full" />
			</div>
		</div>
	</template>

	<style lang="less">
	@import url(./style.less);
	</style>
