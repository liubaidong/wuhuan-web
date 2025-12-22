<script setup lang="ts">
import { ref, reactive, computed } from "vue";
import { useRouter } from "vue-router";
import {
  NButton, NInput, NSpin, NText, useMessage,
  NIcon, useThemeVars
} from "naive-ui";
import { LoginFrom } from "@/typings/user";
import {
  PersonOutline,
  LockClosedOutline,
  LogInOutline,
} from '@vicons/ionicons5';

import { useUserStore } from "@/store/modules/user";
import { useI18n } from "vue-i18n";

const { t } = useI18n();
const userStore = useUserStore();
const router = useRouter();
const message = useMessage();
const themeVars = useThemeVars();

// 表单状态管理
const loginForm = reactive<LoginFrom>({
  username: '',
  password: '',
  type: ''
});

// 加载状态管理
const loginLoading = ref(false);
const pageLoading = ref(false);

// 表单验证
const formErrors = reactive({
  username: '',
  password: ''
});

// 验证表单
function validateForm() {
  let isValid = true;

  // 用户名验证
  if (!loginForm.username) {
    formErrors.username = t('login.usernameRequired');
    isValid = false;
  } else {
    formErrors.username = '';
  }

  // 密码验证
  if (!loginForm.password) {
    formErrors.password = t('login.passwordRequired');
    isValid = false;
  } else {
    formErrors.password = '';
  }

  return isValid;
}

// 账号密码登录
async function handleLogin(e: MouseEvent) {
  if (!validateForm()) return;

  try {
    loginLoading.value = true;
    await userStore.userLogin(loginForm);
    message.success(t("login.loginSuccess"));
    router.push("/");
  } catch (error: any) {
    message.error(error.message || t("login.loginFailed"));
  } finally {
    loginLoading.value = false;
  }
}

// 跳转到注册页面
const navigateToRegister = () => {
  router.push("/regist");
};


// 计算背景样式，适配暗黑模式 - 使用暖橙色渐变
const brandSectionStyle = computed(() => {
  const isDark = themeVars.value.bodyColor.startsWith('#1') ||
    themeVars.value.bodyColor.startsWith('#2') ||
    themeVars.value.bodyColor.startsWith('#3');

  return {
    background: isDark
      ? 'linear-gradient(135deg, #ff9a56 0%, #ffad56 25%, #ffc356 50%, #ffd856 75%, #ffeb56 100%)'
      : 'linear-gradient(135deg, #ff9a56 0%, #ffad56 25%, #ffc356 50%, #ffd856 75%, #ffeb56 100%)',
    position: 'relative',
    overflow: 'hidden'
  };
});

</script>

<template>
  <div class="login-container">
    <NSpin :show="pageLoading">
      <div class="login-content">
        <!-- 左侧品牌区域 -->
        <div class="brand-section" :style="brandSectionStyle">
          <div class="brand-content">
            <h1 class="brand-title">AI知识库系统</h1>
            <p class="brand-description">
              企业级智能知识管理平台，助力数字化转型
            </p>
          </div>
        </div>

        <!-- 右侧登录表单 -->
        <div class="form-wrapper">
  
          <div class="login-methods">
            <div class="active-method">账号密码登录</div>
          </div>

          <div class="form-content">
            <!-- 用户名输入 -->
            <div class="input-group">
              <div class="input-label-row">
                <NText strong class="input-label">
                  {{ $t("login.username") }}
                </NText>
                <div v-if="formErrors.username" class="error-message">{{ formErrors.username }}</div>
              </div>
              <NInput v-model:value="loginForm.username" :placeholder="$t('login.enterEmailOrPhone')" round clearable
                class="custom-input" :status="formErrors.username ? 'error' : undefined">
                <template #prefix>
                  <NIcon :component="PersonOutline" />
                </template>
              </NInput>
            </div>

            <!-- 密码输入 -->
            <div class="input-group">
              <div class="input-label-row">
                <NText strong class="input-label">
                  {{ $t("login.password") }}
                </NText>
                <div v-if="formErrors.password" class="error-message">{{ formErrors.password }}</div>
              </div>
              <NInput v-model:value="loginForm.password" type="password" :placeholder="$t('login.enterPassword')" round
                show-password-on="click" class="custom-input" :status="formErrors.password ? 'error' : undefined">
                <template #prefix>
                  <NIcon :component="LockClosedOutline" />
                </template>
              </NInput>
            </div>

            <!-- 额外链接 -->
            <div class="additional-links">
              <NButton text tag="a" href="#/resetpassword" class="forgot-password">
                {{ $t("login.forgotPassword") }}
              </NButton>
            </div>

            <!-- 登录按钮 -->
            <div class="action-buttons">
              <NButton type="primary" block :loading="loginLoading" @click="handleLogin" class="login-button">
                <template #icon>
                  <NIcon :component="LogInOutline" />
                </template>
                {{ $t("login.login") }}
              </NButton>
            </div>
            
            <!-- 注册提示 -->
            <div class="register-prompt">
              还没有账号？
              <NButton text type="primary" @click="navigateToRegister">
                立即注册
              </NButton>
              并免费体验问答助手
            </div>
          </div>
        </div>
      </div>
    </NSpin>


  </div>
</template>

<style scoped>
.login-container {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  padding: 20px;
  position: relative;
}

.login-content {
  display: flex;
  width: 900px;
  max-width: 100%;
  min-height: 500px;
  border-radius: 24px;
  overflow: hidden;
  box-shadow: 0 20px 60px rgba(255, 154, 86, 0.3);
  backdrop-filter: blur(10px);
  background: rgba(255, 255, 255, 0.95);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  animation: fadeInUp 0.6s ease-out;
}

@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(30px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

html.dark .login-content {
  background: rgba(30, 30, 30, 0.95);
  box-shadow: 0 20px 60px rgba(255, 154, 86, 0.2);
}

/* 左侧品牌区域 */
.brand-section {
  flex: 1;
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40px;
  position: relative;
  overflow: hidden;
}

.brand-section::before {
  content: '';
  position: absolute;
  top: -50%;
  right: -50%;
  width: 200%;
  height: 200%;
  background: radial-gradient(circle, rgba(255, 255, 255, 0.2) 0%, transparent 70%);
  animation: pulse 4s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% {
    transform: scale(1);
    opacity: 0.3;
  }
  50% {
    transform: scale(1.1);
    opacity: 0.5;
  }
}

.brand-content {
  position: relative;
  z-index: 2;
  text-align: center;
}

.brand-title {
  font-size: 2.5rem;
  font-weight: bold;
  margin-bottom: 1rem;
  color: white;
  text-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
  animation: titleFadeIn 0.8s ease-out 0.2s both;
}

@keyframes titleFadeIn {
  from {
    opacity: 0;
    transform: translateY(-20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.brand-description {
  font-size: 1.1rem;
  opacity: 0.9;
  max-width: 300px;
  margin: 0 auto;
  color: rgba(255, 255, 255, 0.95);
  text-shadow: 0 1px 5px rgba(0, 0, 0, 0.2);
  animation: descFadeIn 0.8s ease-out 0.4s both;
}

@keyframes descFadeIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 0.95;
    transform: translateY(0);
  }
}

/* 右侧表单区域 */
.form-wrapper {
  flex: 1;
  background: rgba(255, 255, 255, 0.98);
  padding: 40px;
  display: flex;
  flex-direction: column;
  backdrop-filter: blur(10px);
}

html.dark .form-wrapper {
  background: rgba(30, 30, 30, 0.98);
}

.form-title {
  text-align: center;
  margin-bottom: 1.5rem;
}

.login-methods {
  display: flex;
  justify-content: center;
  margin-bottom: 1.5rem;
}

.active-method {
  font-size: 16px;
  font-weight: 500;
  color: var(--n-text-color);
  padding-bottom: 8px;
  border-bottom: 2px solid #ff9a56;
  transition: all 0.3s ease;
}

.form-content {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.input-group {
  margin-bottom: 1.5rem;
}

.input-label-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.input-label {
  font-size: 14px;
}

.error-message {
  font-size: 12px;
  color: var(--n-error-color);
}

.custom-input {
  transition: all 0.3s ease;
}

.custom-input:hover {
  border-color: #ff9a56;
}

.custom-input:focus {
  border-color: #ff9a56;
  box-shadow: 0 0 0 2px rgba(255, 154, 86, 0.2);
}

.additional-links {
  display: flex;
  justify-content: flex-end;
  margin-bottom: 1rem;
}

.forgot-password {
  font-size: 14px;
}

.action-buttons {
  margin-bottom: 1.5rem;
}

.login-button {
  height: 40px;
  font-size: 16px;
  background: linear-gradient(135deg, #ff9a56 0%, #ffad56 50%, #ffc356 100%);
  border: none;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.login-button:hover {
  background: linear-gradient(135deg, #ffad56 0%, #ffc356 50%, #ffd856 100%);
  transform: translateY(-2px);
  box-shadow: 0 8px 16px rgba(255, 154, 86, 0.4);
}

.login-button:active {
  transform: translateY(0);
}

.alternative-logins {
  display: flex;
  justify-content: center;
  margin: 1rem 0;
}

.wx-login-button {
  color: #07c160;
  border-color: #07c160;
  transition: all 0.3s;
}

.wx-login-button:hover {
  background-color: rgba(7, 193, 96, 0.1);
}

.register-prompt {
  text-align: center;
  font-size: 14px;
  color: var(--n-text-color-3);
  margin-top: auto;
  padding-top: 1rem;
}

/* 微信登录弹窗 */
.wx-modal-header {
  display: flex;
  align-items: center;
  gap: 8px;
}

.wx-modal-title {
  font-size: 18px;
  font-weight: 500;
}

.qrcode-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 20px 0;
  min-height: 280px;
  justify-content: center;
}

.qrcode-image {
  width: 200px;
  height: 200px;
  border: 1px solid var(--n-border-color);
  border-radius: 8px;
}

.qrcode-placeholder {
  width: 200px;
  height: 200px;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: var(--n-color-modal-overlay);
  border-radius: 8px;
  border: 1px dashed var(--n-border-color);
}

.qrcode-tip {
  margin-top: 16px;
  font-size: 14px;
  color: var(--n-text-color-3);
}

/* 错误状态 */
.qrcode-error {
  width: 200px;
  height: 200px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background-color: var(--n-color-modal-overlay);
  border-radius: 8px;
  border: 1px dashed var(--n-border-color);
  padding: 20px;
}

.error-icon {
  color: var(--n-warning-color);
  margin-bottom: 12px;
}

.error-msg {
  text-align: center;
  color: var(--n-text-color);
  margin-bottom: 16px;
  font-size: 14px;
}

.retry-button {
  min-width: 100px;
}

.wx-modal-footer {
  display: flex;
  justify-content: space-between;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .login-content {
    flex-direction: column;
    width: 100%;
  }

  .brand-section {
    padding: 30px;
    min-height: 150px;
  }

  .form-wrapper {
    padding: 30px 20px;
  }

  .brand-title {
    font-size: 2rem;
  }
}
</style>
