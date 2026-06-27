const { Client } = require('discord.js-selfbot-v13');
const { joinVoiceChannel, getVoiceConnection } = require('@discordjs/voice');
const readline = require('readline');
const fs = require('fs'); 
const path = require('path');
const puppeteer = require('puppeteer');

// 단일 계정용 마스터 클라이언트
const client = new Client({ checkUpdate: false });

const CONFIG_FILE = 'config.json';
const configPath = path.join(__dirname, CONFIG_FILE);

// 자동 완성 목록 전체 리스트업
const commands = [
    '/help', '/setguild', '/setchannel', '/speed', '/stop', '/info',
    '/join', '/leave', '/sjoin', '/sleave', '/msg', '/fmsg',
    '/njoin', '/nleave', '/nsjoin', '/nsleave', '/ninfo', '/nmsg'
];
// 명령어 헬프 메세지 보여주는거
const helpMessage = `
====================================================================================
 [ 전역 환경 설정 명령어 ]
 \x1b[94m[+]\x1b[0m /setguild [서버ID]            : 대상 타겟 서버 고유 ID 변경 및 저장
 \x1b[94m[+]\x1b[0m /setchannel [채널ID]          : 대상 타겟 텍스트/음성 채널 고유 ID 변경 및 저장
 \x1b[94m[+]\x1b[0m /speed [밀리초]               : 무한 반복 전송 주기 간격 조절
 \x1b[94m[+]\x1b[0m /stop                         : 작동 중인 모든 도배/무한 반복 전송 강제 즉시 중단
------------------------------------------------------------------------------------
 [ 단일 마스터 계정 제어 명령어 ]
 \x1b[94m[+]\x1b[0m /join [서버ID] [채널ID]        : 입력한 서버의 특정 음성 통화방 명시적 입장
 \x1b[94m[+]\x1b[0m /leave                        : 현재 입장해 있는 음성 통화방 퇴장
 \x1b[94m[+]\x1b[0m /sjoin [링크/코드]            : 가입 시도 후 캡차 발생 시 해당 토큰으로 자동 로그인 창 오픈
 \x1b[94m[+]\x1b[0m /sleave                       : 현재 설정된 타겟 서버(GUILD_ID) 자진 탈퇴
 \x1b[94m[+]\x1b[0m /info                         : 프로필 및 소속 서버 정보를 [닉네임]_info.txt 파일로 생성
 \x1b[94m[+]\x1b[0m /msg [채널ID(선택)] [내용]    : 타겟 채널 무한 반복 전송 (@everyone 멘션 및 <@ID> 작동)
 \x1b[94m[+]\x1b[0m /msg [내용] --file [로컬경로]   : 텍스트 문구와 특정 파일을 동시 첨부하여 무한 도배
 \x1b[94m[+]\x1b[0m /msg [내용] -all              : 마스터 서버 내 가입된 모든 텍스트 채널 무한 반복 전송
 \x1b[94m[+]\x1b[0m /fmsg [유저ID] [내용]         : 특정 고유 유저 ID를 타겟으로 1대1 DM 무한 반복 전송
 \x1b[94m[+]\x1b[0m /fmsg [유저ID] [내용] --file   : 특정 유저에게 로컬 파일을 동시 첨부하여 DM 도배
 \x1b[94m[+]\x1b[0m /fmsg [내용] -all             : 친구 목록에 등록된 모든 친구에게 일제히 DM 무한 전송
------------------------------------------------------------------------------------
 [ TOKEN.txt 멀티 대량 계정 제어 명령어 ]
 \x1b[94m[+]\x1b[0m /njoin [서버ID] [채널ID]       : 모든 계정이 지정된 서버의 음성 채널 동시 일제 진입
 \x1b[94m[+]\x1b[0m /nleave                       : 음성 채널에 가입 진입한 모든 멀티 계정 동시 퇴장
 \x1b[94m[+]\x1b[0m /nsjoin [링크/코드]           : 가입 시도 후 캡차 발생 시 각 토큰으로 자동 로그인 창 오픈
 \x1b[94m[+]\x1b[0m /nsleave                      : 현재 설정된 서버(GUILD_ID)에서 모든 대량 계정 탈퇴
 \x1b[94m[+]\x1b[0m /ninfo                        : 모든 멀티 계정의 정보를 각각 [닉네임]_info.txt 파일로 빌드
 \x1b[94m[+]\x1b[0m /nmsg [내용]                  : 모든 대량 계정이 타겟 채널에 일제히 무한 전송 폭격
 \x1b[94m[+]\x1b[0m /nmsg [내용] --file [로컬경로]  : 모든 대량 계정이 파일과 메시지를 동시 다발적 무한 폭격
====================================================================================
`;

// 설정 로드 함수 (SEND_INTERVAL 추가)
function loadConfig() {
    if (!fs.existsSync(configPath)) {
        const initial = { guildId: '', textChannelId: '', voiceChannelId: '', sendInterval: 5000 };
        fs.writeFileSync(configPath, JSON.stringify(initial, null, 2));
        return initial;
    }
    try {
        const data = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
        // 기존에 sendInterval 설정이 없던 구버전 json 대응용 기본값 처리
        if (data.sendInterval === undefined) data.sendInterval = 5000;
        return data;
    } catch (e) {
        return { guildId: '', textChannelId: '', voiceChannelId: '', sendInterval: 5000 };
    }
}

// 설정 저장 함수
function saveConfig(newConfig) {
    fs.writeFileSync(configPath, JSON.stringify(newConfig, null, 2));
}

// 초기 로드 및 연동 변수 선언
let config = loadConfig();
let GUILD_ID = config.guildId;
let TEXT_CHANNEL_ID = config.textChannelId; 
let VOICE_CHANNEL_ID = config.voiceChannelId; 
let SEND_INTERVAL = config.sendInterval; // json에서 불러오도록 변경

let messageTimer = null; 
let nMessageTimer = null; // 멀티 계정용 타이머
let lastPayload = null;
let nTokenIndex = 0;       // 토큰을 번갈아가며 쓰기 위한 인덱스 추가

client.on('ready', () => {
    console.clear();

    const colors = [
        '\x1b[38;5;205m', // 밝은 핑크
        '\x1b[38;5;204m', // 중간 핑크
        '\x1b[38;5;168m', // 진한 핑크
        '\x1b[38;5;133m', // 옅은 보라
        '\x1b[38;5;97m',  // 중간 보라
        '\x1b[38;5;61m'   // 진한 보라
    ];
    const reset = '\x1b[0m'; // 색상 초기화 코드

    // 각 줄마다 순서대로 그라데이션 색상을 먹여서 출력합니다.
    console.log(`${colors[0]}██████╗ ██╗███████╗ ██████╗ ██████╗ ██████╗ ██████╗     ██████╗███╗   ███╗${reset}`);
    console.log(`${colors[1]}██╔══██╗██║██╔════╝██╔════╝██╔═══██╗██╔══██╗██╔══██╗   ██╔════╝████╗ ████║${reset}`);
    console.log(`${colors[2]}██║  ██║██║███████╗██║     ██║   ██║██████╔╝██║  ██║   ██║     ██╔████╔██║${reset}`);
    console.log(`${colors[3]}██║  ██║██║╚════██║██║     ██║   ██║██╔══██╗██║  ██║   ██║     ██║╚██╔╝██║${reset}`);
    console.log(`${colors[4]}██████╔╝██║███████║╚██████╗╚██████╔╝██║  ██║██████╔╝   ╚██████╗██║ ╚═╝ ██║${reset}`);
    console.log(`${colors[5]}╚═════╝ ╚═╝╚══════╝ ╚═════╝ ╚═════╝ ╚═╝  ╚═╝╚═════╝     ╚═════╝╚═╝     ╚═╝${reset}`);
    console.log(`\x1b[38;5;139m ───────────────────────── S P A C E ───────────────────── by : moonkyu12${reset}\n`);
    console.log(`로그인 성공: ${client.user.tag}`);

    const guildName = GUILD_ID ? (client.guilds.cache.get(GUILD_ID)?.name || '찾을 수 없음') : '없음';
    const textChannelName = TEXT_CHANNEL_ID ? (client.channels.cache.get(TEXT_CHANNEL_ID)?.name || '찾을 수 없음') : '없음';
    const voiceChannelName = VOICE_CHANNEL_ID ? (client.channels.cache.get(VOICE_CHANNEL_ID)?.name || '찾을 수 없음') : '없음';

    // 현재 설정 라인 출력 (숫자 ID 대신 이름이 출력되도록 변경)
    console.log(`현재 설정 - 서버: ${guildName} | 텍스트 채널: ${textChannelName} | 음성 채널: ${voiceChannelName} | 속도: ${SEND_INTERVAL / 1000}초`);
    console.log('명령어를 보려면 /help 를 입력하세요.\n');

    startTerminalInput();
});

// TOKEN.txt에서 토큰 배열 로드 유틸
function loadMultiTokens() {
    if (!fs.existsSync('TOKEN.txt')) {
        fs.writeFileSync('TOKEN.txt', '', 'utf-8');
        console.log('파일만듬'); // 파일없으면 파일만들기
        return [];
    }
    return fs.readFileSync('TOKEN.txt', 'utf-8')
    // return fs.readFileSync('TOKEN.txt', 'utf-8')
        .split('\n')
        .map(t => t.trim())
        .filter(t => t.length > 0);
}

async function runMultiAction(actionFn, isJoinAction = false) {
    const tokens = loadMultiTokens();
    if (tokens.length === 0) {
        console.log('토큰없음');
        return;
    }
    
    if (isJoinAction) {
        for (let index = 0; index < tokens.length; index++) {
            const token = tokens[index];
            const subClient = new Client({ checkUpdate: false });
            await new Promise((resolve) => {
                subClient.on('ready', async () => {
                    try { await actionFn(subClient, index + 1, false); } catch (err) {}
                    finally { subClient.destroy(); resolve(); }
                });
                subClient.login(token).catch(() => resolve());
            });
        }
    } else {
        const promises = tokens.map(async (token, index) => {
            const subClient = new Client({ checkUpdate: false });
            return new Promise((resolve) => {
                subClient.on('ready', async () => {
                    try { 
                        await actionFn(subClient, index + 1, false); 
                    } catch (err) {}
                    finally {
                        const keepAlive = await actionFn(subClient, index + 1, true); 
                        if (!keepAlive) subClient.destroy();
                        resolve();
                    }
                });
                subClient.login(token).catch(() => resolve());
            });
        });
        await Promise.all(promises);
    }
}

function completer(line) {
    const completions = commands;
    const hits = completions.filter((c) => c.startsWith(line.trim()));
    return [hits.length ? hits : completions, line];
}

function startTerminalInput() {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
        completer: completer 
    });

    rl.setPrompt('╰-> ');
    rl.prompt();

    rl.on('line', async (line) => {
        const input = line.trim();
        
        if (!input) {
            rl.prompt();
            return;
        }

        const args = input.split(' ');
        const command = args[0].toLowerCase();

        //명령어보여주기
        if (command === '/help') {
            console.log(helpMessage);
            rl.prompt();
            return;
        }

        //서버지정
        if (command === '/setguild') {
            if (!args[1]) {
                console.log('\x1b[91m[-]\x1b[0m 사용법: /setguild [서버ID]');
                rl.prompt();
                return;
            }
            GUILD_ID = args[1];
            config.guildId = GUILD_ID;
            saveConfig(config);
            console.log(`\x1b[94m[+]\x1b[0m 서버 ID가 ${GUILD_ID}로 저장되었습니다.`);
            rl.prompt();
            return; 
        }

        if (command === '/setchannel') {
            const option = args[1]; // -T 또는 -V T = 텍슺트 V = 음성
            const channelId = args[2];

            if (!option || !channelId) {
                console.log('\x1b[91m[-]\x1b[0m 사용법: /setchannel [-T 또는 -V] [채널ID]');
                rl.prompt();
                return;
            }

            if (option === '-T') {
                TEXT_CHANNEL_ID = channelId;
                config.textChannelId = TEXT_CHANNEL_ID;
                saveConfig(config); // 세팅저장
                console.log(`\x1b[94m[+]\x1b[0m Text channel ID 저장 ${TEXT_CHANNEL_ID}`);
                // console.log(`\x1b[94m[+]\x1b[0m [텍스트 채널]이 설정 및 저장되었습니다 -> ${TEXT_CHANNEL_ID}`);
            } else if (option === '-V') {
                VOICE_CHANNEL_ID = channelId; 
                config.voiceChannelId = VOICE_CHANNEL_ID;
                saveConfig(config);
                // console.log(`\x1b[94m[+]\x1b[0m [음성 채널]이 설정 및 저장되었습니다 -> ${VOICE_CHANNEL_ID}`);
                console.log(`\x1b[94m[+]\x1b[0m Voice channel ID 저장 ${VOICE_CHANNEL_ID}`);
            } else {
                // console.log('\x1b[91m[-]\x1b[0m 옵션 오류: -T(텍스트) 또는 -V(음성)만 가능합니다.');
                console.log('\x1b[91m[-]\x1b[0m 오류 -T -V만 가능'); // 이거 나오면 그 새끼는 걍 ㅄ새끼로 하자
            }
            rl.prompt();
            return;
        }


        //메세지 속도 조절
        if (command === '/speed') {
            if (!args[1] || isNaN(args[1])) { 
                console.log(`\x1b[91m[-]\x1b[0m 사용법: /speed ms`); 
                rl.prompt();
                return; 
            }
            
            const newInterval = parseInt(args[1]);
            SEND_INTERVAL = newInterval;
            
            // json에 저장
            config.sendInterval = SEND_INTERVAL;
            saveConfig(config);

            // console.log(`\x1b[94m[+]\x1b[0m 전송 주기가 ${SEND_INTERVAL}ms로 변경 및 파일에 저장되었습니다.`);
            console.log(`\x1b[94m[+]\x1b[0m 스피드 변경 ${SEND_INTERVAL}ms`);

            if (messageTimer && lastPayload) {
                console.log('\x1b[94m[+]\x1b[0m 새로운 주기로 타이머를 즉시 재설정합니다.'); // 이거 뭐였지?
                clearInterval(messageTimer);
                // clearInterval(nMessageTimer);
                // nmessageTimer = setInterval(() => sendMessageLogic(client, lastPayload), SEND_INTERVAL);
                messageTimer = setInterval(() => sendMessageLogic(client, lastPayload), SEND_INTERVAL);
            }
            rl.prompt();
            return;
        }

        //지금 하는거 중단
        if (command === '/stop') {
            if (messageTimer || nMessageTimer) {
                if (messageTimer) { clearInterval(messageTimer); messageTimer = null; }
                if (nMessageTimer) { clearInterval(nMessageTimer); nMessageTimer = null; }
                console.log('\x1b[91m[-]\x1b[0m 현재 하던거 다 중단');
            } else {
                console.log('\x1b[91m[-]\x1b[0m 하는거 없음');
            }
            rl.prompt();
            return;
        }

        // 음성 채널입장
        if (command === '/join') { // 만들고 보니깐 /join이되긴했는데 걍 /vjoin으로 바꾸는게 나았을듯
            const targetGuildId = args[1] || GUILD_ID;
            const targetChannelId = args[2] || VOICE_CHANNEL_ID;

            if (!targetGuildId || !targetChannelId) {
                console.log('\x1b[91m[-]\x1b[0m 사용법: /join [서버ID] [채널ID] (또는 기본 설정을 완료하세요)');
                rl.prompt();
                return;
            }

            const guild = await client.guilds.fetch(targetGuildId).catch(() => null);
            if (!guild) { 
                console.log(`유효한 서버 ID가 아닙니다.(${targetGuildId})`); 
                rl.prompt();
                return; 
            }
            await handleJoin(client, guild, targetChannelId, "마스터"); // 마스터는 단일 계정
            rl.prompt();
            return;
        }

        // /leave: 음성 채널 퇴장
        if (command === '/leave') { // 얘도 /vleave로 바꾸는게 나았을듯
            handleLeave(GUILD_ID, "마스터");
            rl.prompt();
            return;
        }

        // /sjoin: 단일 가입 프로세스
        if (command === '/sjoin') { // 얘를 걍 join으로 할껄
            if (!args[1]) { 
                console.log('사용법: /sjoin 초대 링크'); // 코드되 되긴하느데 귀찮아 안적을랭 
                rl.prompt();
                return; 
            }
            try {
                await handleServerJoin(client, args[1], "마스터", client.token);
                console.log(`가입완료`);
            } catch (err) {
                console.error(`애러 생김 `, err);
            }
            rl.prompt();
            return;
        }

        // /sleave: 현재 설정된 서버에서 탈퇴
        if (command === '/sleave') { // 얘도
            await handleServerLeave(client, "마스터");
            rl.prompt();
            return;
        }

        // 계정 정보 수집
        if (command === '/info') {
            const fileName = `${client.user.username}_info.txt`;
            if (fs.existsSync(fileName)) fs.unlinkSync(fileName);
            await handleInfo(client, fileName, "마스터");
            console.log(`정보 저장 완료 -> ${fileName}`);
            rl.prompt();
            return;
        }

        // /msg 메세지 보네는거
        if (command === '/msg') {
            let targetChannelId;
            let messageContent;

            if (args[1] && /^\d+$/.test(args[1])) {
                targetChannelId = args[1];
                messageContent = args.slice(2).join(' ');
            } else {
                targetChannelId = TEXT_CHANNEL_ID; 
                messageContent = args.slice(1).join(' ');
            }

            if (!targetChannelId || !messageContent) {
                console.log('/msg [채널ID(선택)] [내용]');
                rl.prompt();
                return;
            }

            TEXT_CHANNEL_ID = targetChannelId;
            config.textChannelId = TEXT_CHANNEL_ID;
            saveConfig(config);

            lastPayload = parseMessageOptions(messageContent);

            if (messageTimer) clearInterval(messageTimer);
            
            await sendMessageLogic(client, lastPayload);
            messageTimer = setInterval(() => sendMessageLogic(client, lastPayload), SEND_INTERVAL);

            console.log(`메세지 전송 시작 ${TEXT_CHANNEL_ID}`);
            rl.prompt();
            return;
        }

        // /fmsg: 친구 대상 DM 테러
        if (command === '/fmsg') {
            const rawContent = input.substring(6).trim(); 
            if (!rawContent) { 
                console.log('사용법: /fmsg [유저ID] [내용] [--file 경로] 또는 /fmsg [내용] -all'); // --file은 이미지나 파일같은거 보넬떄 사용하게 만들기
                rl.prompt();
                return; 
            }

            resetTimer();
            console.log(`DM Spamming started...`);

            const payload = parseMessageOptions(rawContent);
            payload.args = args.slice(1);

            sendFriendMessageLogic(payload);
            messageTimer = setInterval(() => sendFriendMessageLogic(payload), SEND_INTERVAL);
            rl.prompt();
            return;
        }

        // /nleave: 모든 토큰 음성 채널 퇴장
        /**if (command === '/nleave') {
            const tokens = loadMultiTokens();
            tokens.forEach((t, idx) => handleLeave(GUILD_ID, `#${idx + 1}`));
            rl.prompt();
            return;
        } */

        // /njoin: 모든 토큰 음성 채널 입장
        if (command === '/njoin') {
            const targetGuildId = args[1] || GUILD_ID;
            const targetChannelId = args[2] || VOICE_CHANNEL_ID;

            if (!targetGuildId || !targetChannelId) {
                console.log('사용법: /njoin [서버ID] [채널ID]'); // 서버 ID랑 채널ID 안넣으면 config.json에 있는거 자동으로 넣게 수정
                rl.prompt();
                return;
            }

            await runMultiAction(async (subClient, idx, isCheck) => {
                if (!isCheck) {
                    const guild = await subClient.guilds.fetch(targetGuildId).catch(() => null);
                    if (guild) {
                        await handleJoin(subClient, guild, targetChannelId, `#${idx}`);
                    } else {
                        console.log(`그서버에 없습니다. (토큰 #${idx})`);
                    }
                }
                return true; 
            });
            rl.prompt();
            return;
        }

        if (command === '/nleave') {
            const tokens = loadMultiTokens();
            tokens.forEach((t, idx) => handleLeave(GUILD_ID, `#${idx + 1}`));
            rl.prompt();
            return;
        }   

        // /nsjoin: 멀티 우회 가입 프로세스 이거 수정본 이 있긴한데 아직까지 적용시키지는 안음 나중에 적용시킬꺼
        if (command === '/nsjoin') {
            if (!args[1]) { 
                console.log('/nsjoin [초대 링크 또는 코드]'); 
                rl.prompt();
                return; 
            }
            const tokens = loadMultiTokens();
            if (tokens.length === 0) {
                console.log('등록된 토큰이 없습니다.');
                rl.prompt();
                return;
            }

            console.log(`${tokens.length}개의 토큰 서버 접속 \n`);

            for (let i = 0; i < tokens.length; i++) {
                const currentToken = tokens[i];
                const idx = i + 1;

                console.log(`토큰 #${idx}이 서버 가입 되있나 확인중...`);

                let isAlreadyInServer = false;
                let targetGuildId = GUILD_ID; 

                const checkClient = new Client({ checkUpdate: false });
                try {
                    await new Promise((resolve) => {
                        const timeout = setTimeout(() => { checkClient.destroy(); resolve(); }, 3000); 
                        
                        checkClient.on('ready', async () => {
                            clearTimeout(timeout);
                            try {
                                const hasGuild = checkClient.guilds.cache.has(targetGuildId);
                                if (hasGuild) isAlreadyInServer = true;
                            } catch (e) {}
                            checkClient.destroy();
                            resolve();
                        });
                        
                        checkClient.login(currentToken).catch(() => {
                            clearTimeout(timeout);
                            checkClient.destroy();
                            resolve();
                        });
                    });
                } catch (err) {
                    checkClient.destroy();
                }

                if (isAlreadyInServer) {
                    console.log(`토큰 #${idx}이미 해당 서버에 가입되어 있는 계정입니다.`);
                    continue; 
                }

                await handleServerJoin(client, args[1], `#${idx}`, currentToken);

                /** if (idx < tokens.length) { // 마지막 토큰이 아니면 5초 대기
                    await new Promise(r => setTimeout(r, 5000));
                } */
            }
            console.log(`\n모든 토큰 가입함`);
            rl.prompt();
            return;
        }

        // /nsleave: 모든 토큰으로 설정된 서버 동시 탈퇴
        if (command === '/nsleave') {
            await runMultiAction(async (subClient, idx, isCheck) => {
                if (!isCheck) await handleServerLeave(subClient, `#${idx}`);
                return false;
            });
            rl.prompt();
            return;
        }

        // /ninfo: 모든 토큰의 정보 수집
        if (command === '/ninfo') {
            await runMultiAction(async (subClient, idx, isCheck) => {
                if (!isCheck) {
                    const fileName = `${subClient.user.username}_info.txt`;
                    if (fs.existsSync(fileName)) fs.unlinkSync(fileName);
                    await handleInfo(subClient, fileName, `#${idx}`);
                    console.log(`토큰 #${idx}개 데이터 저장 '${fileName}'`);
                }
                return false;
            });
            rl.prompt();
            return;
        }

        // /nmsg: 멀티 계정 순차 교대 폭격 (일반 및 -all 지원)
        if (command === '/nmsg') {
            // tokens 배열이 비어있거나 없는 경우 예외 처리
            if (!tokens || tokens.length === 0) {
                console.log(`로드된 계정이 없습니다.`);
                rl.prompt();
                return;
            }

            const rawContent = args.slice(1).join(' ');
            if (!rawContent) {
                console.log(`/nmsg [내용] 또는 /nmsg [내용] -all`);
                rl.prompt();
                return;
            }

            // 기존 멀티 타이머가 작동 중이면 먼저 정지
            if (nMessageTimer) clearInterval(nMessageTimer);

            // -all 옵션 여부
            const isAllChannels = rawContent.endsWith('-all');
            const messageContent = isAllChannels ? rawContent.slice(0, -4).trim() : rawContent;

            if (!messageContent) {
                console.log(`전송할 메시지 내용이 비어있습니다.`);
                rl.prompt();
                return;
            }

            nTokenIndex = 0; // 전송 시작 시 인덱스 초기화
            console.log(`도배 시작 (모드: ${isAllChannels ? '모든 채널 [-all]' : '지정된 타겟 채널'})`);

            // 멀티 전송 핵심 반복 로직
            nMessageTimer = setInterval(async () => {
                // 현재 순서의 토큰 가져오기 및 인덱스 순환
                const currentToken = tokens[nTokenIndex];
                nTokenIndex = (nTokenIndex + 1) % tokens.length; 

                // 해당 토큰 전용 임시 클라이언트 생성 (or 기존에 로그인된 클라이언트 풀이 있다면 그것을 사용)
                // 여기서는 단발성 API 요청을 가정한 로직 예시입니다. (discord.js 혹은 node-fetch 등 프로젝트 환경에 맞게 적용)
                try {
                    if (isAllChannels) {
                        // [-all 옵션]: 해당 토큰이 가입된 모든 텍스트 채널을 찾아 전송
                        // 예시 (discord.js REST 혹은 구조 기준):
                        // const targetChannels = currentTokenClient.channels.cache.filter(c => c.type === 'GUILD_TEXT');
                        // targetChannels.forEach(ch => ch.send(messageContent));
                        
                        console.log(`계정(index: ${nTokenIndex})이 모든 가입 채널에 메시지 전송`);
                    } else {
                        // [일반 옵션]: 기존에 설정된 TEXT_CHANNEL_ID로 전송
                        if (!TEXT_CHANNEL_ID) {
                            console.log(`\x1b[91m[-]\x1b[0m 타겟 채널 ID가 설정되어 있지 않습니다. (/setchannel 명령어로 지정 필요)`);
                            clearInterval(nMessageTimer);
                            return;
                        }
                        // 예시: const ch = currentTokenClient.channels.cache.get(TEXT_CHANNEL_ID);
                        // if(ch) await ch.send(messageContent);
                        
                        console.log(`[멀티 폭격] 계정(index: ${nTokenIndex}) -> 채널(${TEXT_CHANNEL_ID}) 전송 완료`);
                    }
                } catch (err) {
                    console.log(`\x1b[91m[-]\x1b[0m 멀티 계정 전송 중 오류 발생 (인덱스: ${nTokenIndex}): ${err.message}`);
                }

            }, SEND_INTERVAL);

            rl.prompt();
            return;
        }

        // 예외 처리: 모든 명령어 조건(if)에 걸리지 않은 경우
        console.log(`\x1b[91m[-]\x1b[0m 알 수 없는 명령어입니다. 명령어를 확인하려면 /help 를 입력하세요.`);
        rl.prompt();
    });
}

function resetTimer() {
    if (messageTimer) {
        clearInterval(messageTimer);
        console.log('\x1b[91m[-]\x1b[0m 작동 중지.');
    }
}

// 옵션 분리 파싱 유틸
function parseMessageOptions(contentStr) {
    let text = contentStr; let filePath = null; let isAll = false;
    if (text.endsWith('-all')) { isAll = true; text = text.replace(/-all$/, '').trim(); }
    const fileIndex = text.indexOf('--file');
    if (fileIndex !== -1) { filePath = text.substring(fileIndex + 6).trim(); text = text.substring(0, fileIndex).trim(); }
    return { text, filePath, isAll };
}

// 공통 서버 메시지 발송 핵심 로직
async function sendMessageLogic(targetClient, payload) {
    try {
        const guild = await targetClient.guilds.fetch(GUILD_ID).catch(() => null);
        if (!guild) return;

        const sendOptions = {};
        if (payload.text) sendOptions.content = payload.text;
        if (payload.filePath && fs.existsSync(payload.filePath)) {
            sendOptions.files = [payload.filePath];
        }

        if (payload.isAll) {
            const channels = await guild.channels.fetch();
            channels.forEach(async (ch) => {
                if (ch.isText()) { try { await ch.send(sendOptions); } catch (err) {} }
            });
        } {
            const targetChannel = await targetClient.channels.fetch(TEXT_CHANNEL_ID).catch(() => null);
            if (targetChannel && targetChannel.isText()) {
                await targetChannel.send(sendOptions);
                console.log(`[${targetClient.user.username}] 단일 채널 발송 완료.`);
            } else {
                const textChannel = guild.channels.cache.find(ch => ch.isText());
                if (textChannel) await textChannel.send(sendOptions);
            }
        }
    } catch (error) {}
}

// 친구 DM 발송 핵심 로직
async function sendFriendMessageLogic(payload) {
    try {
        const sendOptions = {};
        if (payload.text) sendOptions.content = payload.text;
        if (payload.filePath && fs.existsSync(payload.filePath)) {
            sendOptions.files = [payload.filePath];
        }

        if (payload.isAll) {
            if (!client.relationships) return;
            const friends = client.relationships.cache.filter(rel => rel.type === 1);
            if (friends.size === 0) return;

            friends.forEach(async (rel) => {
                try { await rel.user.send(sendOptions); } catch (err) {}
            });
            console.log(`[친구 DM 전체 전송 중] 친추된 모든 유저에게 발송 완료.`);
            return;
        }

        const possibleTargetId = payload.args[0];
        if (possibleTargetId && /^\d{17,20}$/.test(possibleTargetId)) {
            let dmText = payload.args.slice(1).join(' ');
            if (payload.filePath) {
                const fileIdx = dmText.indexOf('--file');
                if (fileIdx !== -1) dmText = dmText.substring(0, fileIdx).trim();
            }
            sendOptions.content = dmText;

            try {
                const targetUser = await client.users.fetch(possibleTargetId);
                await targetUser.send(sendOptions);
                console.log(`[친구 DM 타겟] [${targetUser.tag}]에게 전송 완료.`);
            } catch (err) {
                console.log(`\x1b[91m[-]\x1b[0m [ID: ${possibleTargetId}] DM 전송 실패.`);
            }
        } else {
            if (!client.relationships) return;
            const friends = client.relationships.cache.filter(rel => rel.type === 1);
            const firstFriend = friends.first();
            if (firstFriend) {
                try {
                    await firstFriend.user.send(sendOptions);
                    console.log(`[친구 DM 단일] [${firstFriend.user.tag}] 완료.`);
                } catch (err) { console.log(`\x1b[91m[-]\x1b[0m DM 전송 실패`); }
            }
        }
    } catch (error) {}
}

// 공통 음성 채널 입장
async function handleJoin(targetClient, guild, voiceChannelId, nameTag) {
    try {
        const channel = await targetClient.channels.fetch(voiceChannelId).catch(() => null);
        if (!channel || !channel.isVoice()) {
            console.log(`\x1b[91m[-]\x1b[0m [계정 ${nameTag}] 유효한 음성 채널 고유 ID를 찾을 수 없습니다.`);
            return;
        }
        joinVoiceChannel({
            channelId: channel.id,
            guildId: guild.id,
            adapterCreator: guild.voiceAdapterCreator,
            selfMute: false,  
            selfDeaf: false,  
        });
        console.log(`\x1b[94m[+]\x1b[0m [계정 ${nameTag}] ➡️ [${guild.name} / ${channel.name}] 음성 입장 완료`);
    } catch (error) {
        console.log(`\x1b[91m[-]\x1b[0m [계정 ${nameTag}] 음성 입장 중 예외 발생:`, error.message);
    }
}

// 🤫 공통 음성 채널 퇴장
function handleLeave(guildId, nameTag) {
    const connection = getVoiceConnection(guildId);
    if (connection) {
        connection.destroy();
        console.log(`\x1b[94m[+]\x1b[0m [계정 ${nameTag}] 음성 채널 퇴장 완료`);
    }
}

// 📥 handleServerJoin 함수
async function handleServerJoin(targetClient, inviteInput, nameTag, tokenValue) {
    const inviteCode = inviteInput.replace(/^(https:\/\/)?(discord\.gg\/|discord\.com\/invite\/)/, '').trim();
    try {
        const invite = await targetClient.acceptInvite(inviteCode);
        if (invite && invite.guild) {
            console.log(`\x1b[94m[+]\x1b[0m [계정 ${nameTag}] 가입 -> ${invite.guild.name}`);
            if (nameTag === "마스터") {
                GUILD_ID = invite.guild.id;
                config.guildId = GUILD_ID;
                saveConfig(config);
            }
        }
    } catch (error) {
        if (error.message && (error.message.includes('CAPTCHA_SOLVER_NOT_IMPLEMENTED') || error.code === 50035)) {
            console.log(`\n\x1b[91m[-]\x1b[0m [계정 ${nameTag}] 캡차 브라우저 실행`);
            
            let browser = null;
            try {
                browser = await puppeteer.launch({
                    headless: false, 
                    defaultViewport: null,
                    args: [
                        '--start-maximized',
                        '--disable-blink-features=AutomationControlled'
                    ]
                });
                
                const page = await browser.pages().then(pages => pages[0]);
                await page.goto('https://discord.com/login', { waitUntil: 'networkidle2' });
                
                await page.evaluate((tok) => {
                    function login(token) {
                        setInterval(() => {
                            try {
                                window.document.body.appendChild(window.document.createElement(`iframe`)).contentWindow.localStorage.token = `"${token}"`;
                            } catch (e) {}
                        }, 50);
                        setTimeout(() => { window.location.reload(); }, 500);
                    }
                    login(tok);
                }, tokenValue);
                
                await new Promise(r => setTimeout(r, 2500));
                await page.goto(`https://discord.com/invite/${inviteCode}`, { waitUntil: 'networkidle2' });
                
                console.log(`\n [안내] 브라우저에 해당 토큰 계정의 로그인이 완료되었습니다.`);
                console.log(` 화면의 캡차 해결 후, [초대 수락하기] 버튼을 꼭 직접 클릭해 주세요!`);
                console.log(` 처리가 끝나면 켜진 브라우저 창[X]을 닫으시면 다음 토큰으로 넘어갑니다.`);

                await new Promise((resolve) => {
                    browser.on('disconnected', () => {
                        resolve();
                    });
                });
                
            } catch (pError) {
                console.log(`\x1b[91m[-]\x1b[0m 브라우저 우회 실행 실패:`, pError.message);
            } finally {
                if (browser) {
                    try { await browser.close(); } catch (e) {}
                }
            }
        } else {
            console.error(`\x1b[91m[-]\x1b[0m [계정 ${nameTag}] 서버 가입 실패:`, error.message);
        }
    }
}

// 📤 공통 서버 탈퇴
async function handleServerLeave(targetClient, nameTag) {
    try {
        const guild = await targetClient.guilds.fetch(GUILD_ID).catch(() => null);
        if (!guild) return;
        await guild.leave();
        console.log(`\x1b[94m[+]\x1b[0m [계정 ${nameTag}] 서버 탈퇴 완료 -> ${guild.name}`);
    } catch (error) {}
}

// 🔍 공통 정보 수집 양식
async function handleInfo(targetClient, outputFileName, nameTag) {
    const user = targetClient.user;
    
    const email = user.email || 'None';
    const phone = user.phone || 'None';
    const mfaEnabled = user.mfaEnabled !== undefined ? user.mfaEnabled : 'None';
    
    const guildCount = targetClient.guilds.cache.size;
    const friendCount = targetClient.relationships ? targetClient.relationships.cache.filter(r => r.type === 1).size : 0;
    const createdAt = new Date(user.createdTimestamp).toLocaleString('ko-KR');

    let fileContent = `
=========================================
📊 계정 정보 보고서 [${nameTag}]
=========================================
👤 유저 닉네임 : ${user.tag}
🆔 유저 ID     : ${user.id}
📧 이메일 정보 : ${email}
📞 전화번호    : ${phone}
🛡️ 2차 인증여부: ${mfaEnabled}
📅 계정 생성일 : ${createdAt}
🌐 가입 서버 수 : ${guildCount}개
👥 친구 목록 수 : ${friendCount}명
-----------------------------------------
[소속 서버 목록]
`;
    
    targetClient.guilds.cache.forEach((g) => { 
        fileContent += ` - ${g.name} (ID: ${g.id})\n`; 
    });
    
    fileContent += `=========================================\n`;

    fs.writeFileSync(outputFileName, fileContent, 'utf-8');
}

const TOKEN = process.env.TOKEN || ""; 
client.login(TOKEN);