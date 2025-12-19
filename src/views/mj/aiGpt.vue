<script setup lang='ts'>
import { computed,   ref,watch  } from 'vue'
import { useRoute } from 'vue-router'
import { useChat } from '../chat/hooks/useChat'
import {  homeStore, useChatStore } from '@/store'
import { getInitChat, mlog, subModel,getSystemMessage , localSaveAny, canVisionModel
    ,isTTS, subTTS, file2blob, whisperUpload, getHistoryMessage, checkDisableGpt4, chatSetting, isCanBase64Model, } from '@/api'
import { createSession } from '@/api/session'
//import { isNumber } from '@/utils/is'
import { useMessage  } from "naive-ui";
import { t } from "@/locales";

const emit = defineEmits(['finished']);
const { addChat , updateChatSome } = useChat()
const chatStore = useChatStore()
const st=ref({uuid:'1002', index:-1, chatType:0, appId:'' });
const controller = ref<AbortController>( );;// new AbortController();
const dataSources = computed(() => chatStore.getChatByUuid(+st.value.uuid))
const ms= useMessage();
const textRz= ref<string[]>([]);
const finished = ref<boolean>(false);
const goFinish= (  )=>{
    //let dindex = st.value.index>=0? st.value.index : dataSources.value.length - 1;
    //return ;
    if (finished.value) return
    finished.value = true
    updateChatSome( +st.value.uuid,  st.value.index , { dateTime: new Date().toLocaleString(),loading: false })
    //scrollToBottom();
    emit('finished');

    homeStore.setMyData({act:'scrollToBottomIfAtBottom'});
    mlog('🐞 goFinish2',st.value.uuid);
    // setTimeout(() => {

    //    if(textRz.value.length>0 )  textRz.value = [];
    // }, 200 );
}

const getMessage= async (start=1000,loadingCnt=3)=>{
    return getHistoryMessage(dataSources.value,loadingCnt,start);
}
watch( ()=>textRz.value, (n)=>{
    //mlog('🐞 textRz',n);
    if(n.length==0) return ;
    updateChatSome( +st.value.uuid, st.value.index , { dateTime: new Date().toLocaleString(),text: n.join('') })
    //scrollToBottom();
    homeStore.setMyData({act:'scrollToBottomIfAtBottom'})
    //homeStore.setMyData({act:'scrollToBottom'})
},{deep:true})
const { uuid } = useRoute().params as { uuid: string }
watch(()=>homeStore.myData.act, async (n)=>{

    if(n=='gpt.submit' ||  n=='gpt.whisper'  ){
        finished.value = false

        const dd:any = homeStore.myData.actData;

        let  uuid2 =  dd.uuid?? uuid;
        st.value.uuid =  uuid2 ;
        st.value.chatType = dd.chatType;
        st.value.appId = dd.appId??'';
        const chatSet = new chatSetting(   +st.value.uuid  );
        const nGptStore =   chatSet.getGptConfig();
         mlog('gpt.submit', dd , dd.uuid,  nGptStore ) ;
        let model = nGptStore.model ;//gptConfigStore.myData.model

        if(checkDisableGpt4( model )){
            ms.error( t('mj.disableGpt4') );
            // 停止加载，避免需要手动点击“停止响应”
            homeStore.setMyData({ act: 'stopLoading' })
            return false;
        }

        let promptMsg = getInitChat(dd.prompt );
        if( dd.fileBase64 && dd.fileBase64.length>0 ){
            if( !canVisionModel(model)  ) model='gpt-image';
            // 设置是否有附件为true
            nGptStore.hasAttachment = true;
            // 立即保存到聊天设置中
            chatSet.save({ hasAttachment: true });
            mlog('🐞 检测到附件，设置hasAttachment为true');

            try{
                    let images= await localSaveAny( JSON.stringify( dd.fileBase64)  ) ;
                    mlog('key', images );
                    promptMsg.opt= {images:[images]}
            }catch(e){
                mlog('localSaveAny error',e);
            }
        } else {
            // 没有附件时设置为false
            nGptStore.hasAttachment = false;
            // 立即保存到聊天设置中
            chatSet.save({ hasAttachment: false });
            mlog('🐞 没有附件，设置hasAttachment为false');
        }
        if( n=='gpt.whisper'){
            //model='whisper-1';
            // 语音识别也有附件（音频文件）
            nGptStore.hasAttachment = true;
            // 立即保存到聊天设置中
            chatSet.save({ hasAttachment: true });
            mlog('🐞 语音识别，设置hasAttachment为true');
            
            try{
                let bb= await file2blob( dd.file );
                // bb.blob
                let lkey = await localSaveAny( bb   ) ;
                mlog('key', lkey );
                promptMsg.opt= { lkey  }
                promptMsg.text='Loading...'
                promptMsg.model='whisper-1';
                if(dd.duration && dd.duration>0 ){
                     promptMsg.text=`${t('mj.lang')} ${dd.duration.toFixed(2)}s`;
                }
                addChat(  +uuid2, promptMsg );
                homeStore.setMyData({act:'scrollToBottom'});
            }catch(e){
                mlog('localSaveAny error',e);
                ms.error( t('mj.noSupperChrom') );
                return ;
            }

            try{
                const formData = new FormData( );
                formData.append('file',dd.file );
                formData.append('model', 'whisper-1');
                const whisper=  await whisperUpload( formData);
                mlog('whisper 内容>> ', whisper );
                let opt={duration:0,...promptMsg.opt };
                opt.duration= dd.duration??0;
                updateChatSome(  +uuid2, dataSources.value.length-1, {text:whisper.text,opt } );
                dd.prompt= whisper.text;
                //return ;
            }catch(e){
                updateChatSome(  +uuid2, dataSources.value.length-1, {text:`${t('mj.fail')}：${e}` } );
                // 捕获到 Whisper 失败时，主动停止加载
                homeStore.setMyData({ act: 'stopLoading' })
                return ;
            }

        }else{
            addChat(  +uuid2, promptMsg );
            homeStore.setMyData({act:'scrollToBottom'});
        }

        let outMsg: Chat.Chat={
            dateTime: new Date().toLocaleString(),
            text: t('mj.thinking') ,//'思考中...',
            loading: true,
            inversion: false,
            error: false,
            conversationOptions: null,
            requestOptions: { prompt: dd.prompt, options: {  } },
            uuid:+uuid2,
            model ,
            myid: `${Date.now()}`
        }
        // if(gptConfigStore.myData.gpts){
        //     outMsg.logo= gptConfigStore.myData.gpts.logo ;
        // }
        //  const chatSet = new chatSetting(   +st.value.uuid  );
        // const nGptStore =   chatSet.getGptConfig()  ;
        //chatSet
        if( nGptStore.gpts ){
            outMsg.logo= nGptStore.gpts.logo ;
        }
        addChat(  +uuid2, outMsg  )
        st.value.index= dataSources.value.length - 1;
        if(textRz.value.length>=0) textRz.value = [ ];

        homeStore.setMyData({act:'scrollToBottom'})
        let historyMesg=  await getMessage();
        mlog('historyMesg', historyMesg );
        //return ;
        // 优先使用 actData 中的 systemMessage，如果没有则使用 getSystemMessage
        const systemMessage = dd.systemMessage || getSystemMessage(+uuid2);
        let message = systemMessage 
          ? [{ "role": "system", "content": systemMessage }, ...historyMesg]
          : [...historyMesg];
                
        if( dd.fileBase64 && dd.fileBase64.length>0 ){
            if(isCanBase64Model(model)){ 
                let obj={
                        "role": "user",
                       "content": [] as any
                }
                obj.content.push({ "type": "text",      "text": dd.prompt  });
                dd.fileBase64.forEach((f:any)=>{
                    obj.content.push({ "type": "image_url",  "image_url": {url:f }   });
                });
                message.push(obj); 
            }else{
                let cc= dd.prompt;
                //附件需要时远程的图片链接 或者文件 链接
                let arr = dd.fileBase64.filter( (ff:string)=>ff.indexOf('http')>-1);
                if(arr.length>0) cc = arr.join(' ')+' '+ cc ;
                message.push({  "role": "user",  "content": cc })
            }
        }else{
            message.push({  "role": "user",  "content": dd.prompt })
        }
        let opt={};
        if( n=='gpt.whisper'){
            opt= {
                file: dd.file
            }
        }

        submit(model,message,opt);

    }else if(n=='abort'){
       controller.value && controller.value.abort();
    }else if(n=='gpt.resubmit'){
        finished.value = false
        //  if(checkDisableGpt4(gptConfigStore.myData.model)){
        //     ms.error( t('mj.disableGpt4') );
        //     return false;
        // }
        const dd:any = homeStore.myData.actData;
        let  uuid2 =  dd.uuid?? uuid;
        st.value.uuid =  uuid2 ;
        st.value.index = +dd.index;

        mlog('gpt.resubmit', dd  ) ;
        let historyMesg= await  getMessage( (+dd.index)-1,1  ); //
        mlog('gpt.resubmit historyMesg', historyMesg );
        let nobj = dataSources.value[ dd.index ];
        //mlog('gpt.resubmit model', nobj.model  );
        let model = nobj.model as string

        if(checkDisableGpt4(  model )){
            ms.error( t('mj.disableGpt4') );
            homeStore.setMyData({ act: 'stopLoading' })
            return false;
        }
        //return ;
        if(['whisper-1','midjourney'].indexOf(model)>-1){
            ms.error( t('mj.noSuppertModel') );
            homeStore.setMyData({ act: 'stopLoading' })
            return;
        }

        controller.value = new AbortController();
        let message= [ {  "role": "system", "content": getSystemMessage(+st.value.uuid ) },
                ...historyMesg ];
        // 重新生成时清空上一条助理消息的文本，避免将错误与新内容合并
        try {
            updateChatSome(+st.value.uuid, st.value.index, {
                dateTime: new Date().toLocaleString(),
                text: '',
                error: false,
                loading: true,
            })
        } catch {}
        textRz.value=[];

        submit(model, message);

    }else if(n=='gpt.ttsv2'){
        finished.value = false
        const actData:any = homeStore.myData.actData;
        mlog('gpt.ttsv2',actData );
        st.value.index= actData.index;
        st.value.uuid= actData.uuid;
        ms.info( t('mj.ttsLoading'));
        const chatSet = new chatSetting(   +st.value.uuid  );
        const nGptStore =   chatSet.getGptConfig()  ;

        subTTS({model:'tts-1',input: actData.text , voice:nGptStore.tts_voice }).then(d=>{
                ms.success( t('mj.ttsSuccess'));
                mlog('subTTS',d );
                //d.player.play();
                //textRz.value.push('ok');
                updateChatSome( +st.value.uuid,  st.value.index
                , {
                dateTime: new Date().toLocaleString(),loading: false

                ,opt:{duration:d.duration,lkey:d.saveID }
                });
               // goFinish();
                setTimeout(() => {
                    homeStore.setMyData({act:'playtts',actData:{ saveID:d.saveID} });
                }, 100);
            }).catch(e=>{
                let  emsg =   (JSON.stringify(  e.reason? JSON.parse( e.reason ):e,null,2));
                if(e.message!='canceled' && emsg.indexOf('aborted')==-1 ) textRz.value.push("\n"+t('mjchat.failReason')+" \n```\n"+emsg+"\n```\n");
                // TTS 失败也应结束加载
                goFinish();
            });
    }
})

import { createSession, getSessionById } from '@/api/session'
import { getUserInfo } from '@/api/user'

const submit= (model:string, message:any[],opt?:any)=>{
    mlog('提交Model', model  );
    const chatSet = new chatSetting(   +st.value.uuid  );
    const nGptStore =   chatSet.getGptConfig()  ;
    
    // 若无会话ID，首次发消息时创建后端会话，并把本地 uuid 作为 id 透传
    if(!nGptStore.conversationId){
        // 生成短ID：移除连字符并截断至 32 字符，避免数据库列长度溢出
        const cid = (() => {
            try {
                if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
                    return crypto.randomUUID().replace(/-/g, '').slice(0, 32)
                }
                const raw = Date.now().toString(36) + Math.random().toString(36).slice(2)
                return raw.replace(/[^a-z0-9]/gi, '').slice(0, 32)
            } catch {
                return ('c' + Date.now().toString(36)).slice(0, 32)
            }
        })()
        const last = message[message.length-1]
        let sessionTitle = 'New Chat'
        try{
            if(typeof last?.content === 'string') sessionTitle = last.content
            else if(Array.isArray(last?.content)){
                const textItem = last.content.find((c:any)=>c?.type==='text')
                sessionTitle = textItem?.text || sessionTitle
            }
            sessionTitle = (sessionTitle || 'New Chat').slice(0,50)
        }catch{}

        // 本地先保存 conversationId，后端创建失败也不影响发送流程
        chatSet.save({ conversationId: cid })

        // 幂等保护：若后端已存在该 id，则不再创建，避免主键重复
        const uuidNum = +st.value.uuid
        ;(async () => {
            let uid: number | undefined = undefined
            try { const info = await getUserInfo(); uid = Number(info?.data?.user?.userId) } catch {}
            let exists = false
            try {
                const resp: any = await getSessionById(uuidNum)
                const data = resp?.data ?? resp?.rows ?? null
                // 仅当返回有实体数据时视为存在；避免 200 + null 导致误判
                exists = !!(data && (Array.isArray(data) ? data.length > 0 : true))
                mlog('session exists check', { uuid: uuidNum, exists, raw: resp })
            } catch { exists = false }
            if (!exists) {
                try { await createSession({ id: uuidNum, userId: uid, sessionTitle, conversationId: cid }); chatSet.save({ sessionSynced: true }) }
                catch { /* 忽略错误，继续发送消息流程 */ }
            } else {
                chatSet.save({ sessionSynced: true })
            }
        })()
    }
    
    // 保存新的配置参数
    chatSet.save({
        hasAttachment: nGptStore.hasAttachment,
        autoSelectModel: nGptStore.autoSelectModel
    });
    
    // 添加调试日志
    mlog('🐞 submit函数中的参数:', {
        hasAttachment: nGptStore.hasAttachment,
        autoSelectModel: nGptStore.autoSelectModel,
        uuid: st.value.uuid
    });
    
    controller.value = new AbortController();
        if(model=='whisper-1'){

            //mlog('whisper-12323',opt  );
            const formData = new FormData( );
            formData.append('file', opt.file );
            formData.append('model', 'whisper-1');

            //GptUploader('/v1/audio/transcriptions',formData).then(r=>{
            whisperUpload( formData).then(r=>{
                //mlog('语音识别成功', r );
                textRz.value.push(r.text);
                goFinish();
            }).catch(e=>{
                let emsg =( ( e.message?? JSON.stringify(e)) );
                textRz.value.push("\n"+t('mj.failOcr')+":\n```\n"+emsg+"\n```\n");
                goFinish();
            });
            return ;
        }
        else if( isTTS(model)){
            let text  = message[message.length-1].content;
            mlog('whisper-tts',  message[message.length-1] , text  );
            subTTS({model,input: text, voice:nGptStore.tts_voice }).then(d=>{
                mlog('subTTS',d );
                //d.player.play();
                //textRz.value.push('ok');
                updateChatSome( +st.value.uuid,  st.value.index
                , {
                dateTime: new Date().toLocaleString(),loading: false
                ,text:'ok'
                ,opt:{duration:d.duration,lkey:d.saveID }
                });
                goFinish();
                setTimeout(() => {
                    homeStore.setMyData({act:'playtts',actData:{ saveID:d.saveID} });
                }, 100);
            }).catch(e=>{
                let  emsg =   (JSON.stringify(  e.reason? JSON.parse( e.reason ):e,null,2));
                if(e.message!='canceled' && emsg.indexOf('aborted')==-1 ) textRz.value.push("\n"+t('mjchat.failReason')+" \n```\n"+emsg+"\n```\n");
                goFinish();
            });

        }else{
            subModel( {message, model,
                uuid: st.value.uuid //当前会话
                ,onMessage: (d) => {
                    mlog('🐞消息', d)
                    if (finished.value) return
                    // 检测后端流式返回中的错误文本，自动结束响应，无需手动点击停止
                    const txt = d?.text ?? ''
                    const isModelError = typeof txt === 'string' && (
                        txt.includes('未找到模型名称') ||
                        txt.includes('模型选择和服务获取失败') ||
                        txt.toLowerCase().includes('model') && txt.toLowerCase().includes('not found')
                    )
                    if (isModelError) {
                        // 解除当前错误会话绑定，下次重新建立新会话，避免沿用错误的会话配置
                        try { const cs = new chatSetting(+st.value.uuid); cs.save({ conversationId: undefined }) } catch {}
                        // 标记当前消息为错误，供下次构建上下文时剔除
                        try { updateChatSome(+st.value.uuid, st.value.index, { error: true }) } catch {}
                        textRz.value.push("\n" + t('mjchat.failReason') + "\n```\n" + txt + "\n```\n")
                        goFinish()
                        return
                    }
                    textRz.value.push(txt)
                },
                onError: (e: any) => {
                    mlog('onError', e)
                    let emsg = (JSON.stringify(e.reason ? JSON.parse(e.reason) : e, null, 2))
                    //if(emsg=='{}' ) emsg= JSON.stringify(e );
                    // 如果是模型错误，重置会话ID以便下一次重新建立会话
                    try {
                      const raw = typeof e?.reason === 'string' ? e.reason : emsg
                      const hit = raw && (raw.includes('未找到模型名称') || raw.includes('模型选择和服务获取失败'))
                      if (hit) { const cs = new chatSetting(+st.value.uuid); cs.save({ conversationId: undefined }) }
                    } catch {}
                    // 标记为错误，避免下一次把错误文本带入上下文
                    try { updateChatSome(+st.value.uuid, st.value.index, { error: true }) } catch {}
                    if (e.message != 'canceled' && emsg.indexOf('aborted') == -1) textRz.value.push("\n" + t('mjchat.failReason') + "\n```\n" + emsg + "\n```\n")
                    goFinish()
                },
                signal: controller.value.signal,
                kid: '',
                chatType: st.value.chatType,
                appId: st.value.appId,
                hasAttachment: nGptStore.hasAttachment,
                autoSelectModel: nGptStore.autoSelectModel
            }).then(()=>goFinish() ).catch(e=>{
                if(e.message!='canceled')  textRz.value.push("\n"+t('mj.fail')+":\n```\n"+(e.reason??JSON.stringify(e,null,2)) +"\n```\n")
                goFinish();
            });
        }
}

homeStore.setMyData({isLoader:false});
</script>
<template>

</template>
