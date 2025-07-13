// 全局配置
const CONFIG = {
    BUILTIN_VERSION: 20,
    UPDATE_URL: "https://gitee.com/yuan-kao/999999/raw/master/2",
    SUB_ADDRESS: {
        "男": ["2号楼", "国际交流中心", "4号楼1单元", "4号楼2单元", "10号楼a区", 
              "10号楼b区", "10号楼c区", "10号楼d区", "6号楼", "7号楼东"],
        "女": ["1号楼", "3号楼", "4号楼三单元", "5号楼", "7号楼西", "8号楼", "9号楼"]
    },
    API_BASE: "https://api.lanzhutiaodong.top"
};

// 全局状态（新增请求计数相关变量）
const state = {
    token: localStorage.getItem('token') || null,
    exitFlag: false,
    monitorThreads: [],
    selectedSubAddresses: [],
    userInfo: null,
    isLoading: false,
    requestStats: {  // 新增：请求统计数据
        total: 0,     // 总请求次数
        success: 0    // 成功请求次数
    }
};

// DOM元素
const $ = (id) => document.getElementById(id);
const modules = {
    login: $('loginModule'),
    config: $('configModule'),
    monitor: $('monitorModule'),
    other: $('otherModule'),
    search: $('searchModule')
};

// 工具函数
const showToast = (msg, duration = 3000) => {
    const toast = $('toast');
    toast.textContent = msg;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), duration);
};

const switchModule = (moduleName) => {
    Object.keys(modules).forEach(key => {
        modules[key].classList.remove('active');
    });
    modules[moduleName].classList.add('active');
    
    // 切换到配置页时加载个人信息
    if (moduleName === 'config' && state.token) {
        showConfigUserInfo();
    }
};

const formatTime = () => {
    const now = new Date();
    return now.toTimeString().slice(0, 8);
};

const setLoading = (isLoading) => {
    state.isLoading = isLoading;
    $('loading').style.display = isLoading ? 'flex' : 'none';
};

// 新增：更新请求统计显示
const updateRequestStats = () => {
    $('requestCount').textContent = `总请求次数：${state.requestStats.total}`;
    const successRate = state.requestStats.total > 0 
        ? Math.round((state.requestStats.success / state.requestStats.total) * 100) 
        : 0;
    $('successRate').textContent = `成功率：${successRate}%`;
};

// 地址匹配算法
const addressMatch = (apiAddress, mainAddress, selectedSub) => {
    if (!apiAddress) return false;
    const cleaned = apiAddress.trim().replace(/\s+/g, ' ');
    const parts = cleaned.split(' ');
    if (parts.length < 2) return false;

    const mainPart = parts[0];
    const expectedMains = [mainAddress, mainAddress.replace('(', '（').replace(')', '）')];
    if (!expectedMains.includes(mainPart)) return false;

    const subPart = parts.slice(1).join(' ');
    return selectedSub.some(sub => subPart.includes(sub));
};

// 登录相关
const loadSavedTokens = () => {
    const tokenList = $('tokenList');
    tokenList.innerHTML = '';
    const keys = Object.keys(localStorage).filter(k => k.endsWith('_token'));
    if (keys.length === 0) {
        tokenList.innerHTML = '<div>无保存的账号，请登录</div>';
        return;
    }
    keys.forEach(key => {
        const div = document.createElement('div');
        div.textContent = key.replace('_token', '');
        div.onclick = async () => {
            setLoading(true);
            const token = localStorage.getItem(key);
            const isValid = await verifyToken(token);
            if (isValid) {
                state.token = token;
                localStorage.setItem('token', state.token);
                showToast(`已选择账号：${key.replace('_token', '')}`);
                switchModule('config');
                initConfigModule();
            } else {
                showToast('Token已过期，请重新登录');
                localStorage.removeItem(key);
            }
            setLoading(false);
        };
        tokenList.appendChild(div);
    });
};

const verifyToken = async (token) => {
    try {
        const res = await fetch(`${CONFIG.API_BASE}/api/delivery/info`, {
            method: 'GET',
            headers: {
                'X-APPID': 'dPgKLqAyM86Wda4z',
                'X-Token': token,
                'X-Model': '12345',
                'X-Platform': 'android',
                'Content-Type': 'application/json'
            },
            mode: 'cors',
            credentials: 'include'
        });
        const data = await res.json();
        return data.code === 20000;
    } catch (e) {
        console.error('Token验证失败:', e);
        return false;
    }
};

const sendCode = async () => {
    const phone = $('phone').value.trim();
    if (!/^\d{11}$/.test(phone)) {
        showToast('请输入正确的手机号');
        return;
    }

    try {
        setLoading(true);
        const res = await fetch(`${CONFIG.API_BASE}/api/delivery/loginSms`, {
            method: 'POST',
            headers: {
                'X-APPID': 'dPgKLqAyM86Wda4z',
                'X-Model': '12345',
                'X-Platform': 'android',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ mobile: phone }),
            mode: 'cors',
            credentials: 'include'
        });
        const data = await res.json();
        if (data.code === 20000) {
            showToast('验证码发送成功');
            $('codeGroup').style.display = 'block';
            $('loginBtn').style.display = 'inline-block';
            $('sendCodeBtn').disabled = true;
        } else {
            showToast(`发送失败：${data.msg || '未知错误'}`);
        }
    } catch (e) {
        showToast(`请求失败：${e.message}`);
    } finally {
        setLoading(false);
    }
};

const login = async () => {
    const phone = $('phone').value.trim();
    const code = $('code').value.trim();
    const fileName = $('fileName').value.trim() || 'token';

    if (!code || code.length !== 6) {
        showToast('请输入6位验证码');
        return;
    }

    try {
        setLoading(true);
        const res = await fetch(`${CONFIG.API_BASE}/api/delivery/login`, {
            method: 'POST',
            headers: {
                'X-APPID': 'dPgKLqAyM86Wda4z',
                'X-Model': '12345',
                'X-Platform': 'android',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ mobile: phone, code }),
            mode: 'cors',
            credentials: 'include'
        });
        const data = await res.json();
        if (data.code === 20000) {
            state.token = data.data.token;
            localStorage.setItem('token', state.token);
            localStorage.setItem(`${fileName}_token`, state.token);
            showToast('登录成功');
            switchModule('config');
            initConfigModule();
            loadSavedTokens();
        } else {
            showToast(`登录失败：${data.msg || '未知错误'}`);
        }
    } catch (e) {
        showToast(`请求失败：${e.message}`);
    } finally {
        setLoading(false);
    }
};

// 配置模块
const initConfigModule = () => {
    // 加载地址选项
    const container = $('subAddressContainer');
    container.innerHTML = '';
    const gender = document.querySelector('input[name="gender"]:checked').value;
    CONFIG.SUB_ADDRESS[gender].forEach(addr => {
        const label = document.createElement('label');
        label.innerHTML = `<input type="checkbox" value="${addr}"> ${addr}`;
        container.appendChild(label);
    });

    // 加载配置
    $('threadCount').value = localStorage.getItem('threadCount') || 1;
    $('interval').value = localStorage.getItem('interval') || 1000;
    $('orderLimit').value = localStorage.getItem('orderLimit') || 0;

    // 加载配置页个人信息
    showConfigUserInfo();
};

const showConfigUserInfo = async () => {
    const infoContainer = $('configUserInfo');
    if (!state.token) {
        infoContainer.innerHTML = '<div class="info-empty">未登录，请先登录</div>';
        return;
    }

    try {
        infoContainer.innerHTML = '<div>加载中...</div>';
        const res = await fetch(`${CONFIG.API_BASE}/api/delivery/info`, {
            method: 'GET',
            headers: {
                'Host': 'api.lanzhutiaodong.top',
                'X-APPID': 'dPgKLqAyM86Wda4z',
                'X-Token': state.token,
                'X-Model': '12345',
                'X-Platform': 'android',
                'Referer': 'https://servicewechat.com/wxcdd5251a046007ba/20/page-frame.html'
            },
            mode: 'cors',
            credentials: 'include'
        });

        const data = await res.json();
        if (data.code === 20000) {
            const user = data.data.item;
            state.userInfo = user;
            infoContainer.innerHTML = `
                <div>用户名：${user.nick_name || '未知'}(${user.names || '未知'})</div>
                <div>电话：${user.mobile || '未知'}</div>
                <div>余额：¥${user.balance || 0}</div>
                <div>身份证号：${user.id_card ? user.id_card.replace(/(\d{6})(\d{8})(\d{4})/, '$1********$3') : '未提供'}</div>
            `;
        } else if (data.code === 50008) {
            infoContainer.innerHTML = '<div class="info-empty">Token已过期，请重新登录</div>';
        } else {
            infoContainer.innerHTML = `<div class="info-empty">获取失败：${data.msg || '未知错误'}</div>`;
        }
    } catch (e) {
        infoContainer.innerHTML = `<div class="info-empty">加载失败：${e.message}</div>`;
    }
};

const handleGenderChange = () => {
    initConfigModule();
};

const selectAllAddresses = (checked) => {
    const checkboxes = document.querySelectorAll('#subAddressContainer input[type="checkbox"]');
    checkboxes.forEach(cb => cb.checked = checked);
};

const getSelectedAddresses = () => {
    const checkboxes = document.querySelectorAll('#subAddressContainer input[type="checkbox"]:checked');
    return Array.from(checkboxes).map(cb => cb.value);
};

// 监控模块
const showUserInfo = async () => {
    if (!state.token) {
        showToast('未登录，请先登录');
        return false;
    }

    try {
        setLoading(true);
        const res = await fetch(`${CONFIG.API_BASE}/api/delivery/info`, {
            method: 'GET',
            headers: {
                'Host': 'api.lanzhutiaodong.top',
                'X-APPID': 'dPgKLqAyM86Wda4z',
                'X-Token': state.token,
                'X-Model': '12345',
                'X-Platform': 'android',
                'Referer': 'https://servicewechat.com/wxcdd5251a046007ba/20/page-frame.html'
            },
            mode: 'cors',
            credentials: 'include'
        });

        const data = await res.json();
        if (data.code === 20000) {
            state.userInfo = data.data.item;
            const infoHtml = `
                <div>用户名：${state.userInfo.nick_name || '未知'}(${state.userInfo.names || '未知'})</div>
                <div>电话：${state.userInfo.mobile || '未知'}</div>
                <div>余额：¥${state.userInfo.balance || 0}</div>
                <div>身份证号：${state.userInfo.id_card || '未提供'}</div>
            `;
            document.querySelector('.user-info').innerHTML = infoHtml;
            return true;
        } else if (data.code === 50008) {
            showToast('Token已过期，请重新登录');
            switchModule('login');
            return false;
        } else {
            showToast(`获取信息失败：${data.msg || '未知错误'}`);
            return false;
        }
    } catch (e) {
        console.error('个人信息请求异常:', e);
        showToast(`获取用户信息失败：${e.message}`);
        return false;
    } finally {
        setLoading(false);
    }
};

// 监控订单（新增请求计数逻辑）
const monitorOrder = async (threadIndex, delay) => {
    const gender = document.querySelector('input[name="gender"]:checked').value;
    const mainAddress = gender === '男' ? '枣科宿舍(男)' : '枣科宿舍(女)';
    const orderLimit = parseInt($('orderLimit').value) || 0;

    try {
        // 延迟启动，避免请求拥堵
        if (threadIndex > 0) {
            await new Promise(res => setTimeout(res, delay));
        }

        while (!state.exitFlag) {
            try {
                // 新增：请求计数+1
                state.requestStats.total++;
                updateRequestStats();

                // 更新时间
                $('time').textContent = formatTime();

                // 获取订单列表
                const res = await fetch(`${CONFIG.API_BASE}/api/order/deliveryOrders?page=1&limit=10&lng=117.18825&lat=35.102837&sort=true`, {
                    headers: {
                        'Host': 'api.lanzhutiaodong.top',
                        'X-APPID': 'dPgKLqAyM86Wda4z',
                        'X-Token': state.token,
                        'X-Model': '12345',
                        'X-Platform': 'android',
                        'Referer': 'https://servicewechat.com/wxcdd5251a046007ba/20/page-frame.html'
                    },
                    mode: 'cors',
                    credentials: 'include',
                    timeout: 10000
                });

                // 新增：请求成功计数+1
                state.requestStats.success++;
                updateRequestStats();

                if (!res.ok) {
                    throw new Error(`HTTP错误：${res.status}`);
                }

                const data = await res.json();
                const orders = data.data?.items || [];

                if (orders.length === 0) {
                    $('status').textContent = `线程${threadIndex + 1}：未发现订单`;
                    await new Promise(res => setTimeout(res, parseInt($('interval').value)));
                    continue;
                }

                // 检查订单是否匹配
                for (const order of orders) {
                    if (state.exitFlag) break;
                    const address = order.receive?.address || '';
                    if (addressMatch(address, mainAddress, state.selectedSubAddresses)) {
                        $('status').textContent = `线程${threadIndex + 1}：发现匹配订单！`;
                        
                        // 记录订单
                        const record = document.createElement('div');
                        record.innerHTML = `
                            <div>时间：${formatTime()}</div>
                            <div>订单ID：${order.id || '未知'}</div>
                            <div>地址：${address}</div>
                        `;
                        $('orderRecords').prepend(record);

                        // 尝试抢单
                        const acceptRes = await fetch(`${CONFIG.API_BASE}/api/delivery/accept?id=${order.id}&is_confirm=false`, {
                            headers: {
                                'Host': 'api.lanzhutiaodong.top',
                                'X-APPID': 'dPgKLqAyM86Wda4z',
                                'X-Token': state.token,
                                'X-Model': '12345',
                                'X-Platform': 'android'
                            },
                            mode: 'cors',
                            credentials: 'include',
                            timeout: 8000
                        });

                        const acceptData = await acceptRes.json();
                        
                        if (acceptData.code === 20000) {
                            record.classList.add('success');
                            record.innerHTML += '<div>状态：抢单成功！</div>';
                            showToast('抢单成功！');
                            // 检查是否达到限制
                            if (orderLimit > 0) {
                                const ddlRes = await fetch(`${CONFIG.API_BASE}/api/delivery/survey`, {
                                    headers: { 'X-Token': state.token }
                                });
                                const ddlData = await ddlRes.json();
                                if (ddlData.data?.ready_number >= orderLimit) {
                                    showToast(`已达到抢单限制${orderLimit}，停止监控`);
                                    stopMonitor();
                                    return;
                                }
                            }
                        } else {
                            record.classList.add('error');
                            record.innerHTML += `<div>状态：抢单失败（${acceptData.msg || '未知错误'}）</div>`;
                        }
                    }
                }
            } catch (e) {
                $('status').textContent = `线程${threadIndex + 1}：错误 - ${e.message}`;
            }
            await new Promise(res => setTimeout(res, parseInt($('interval').value)));
        }
    } catch (e) {
        console.error(`线程${threadIndex}异常：`, e);
        showToast(`线程${threadIndex + 1}异常：${e.message}`);
    }
};

// 启动监控（新增计数重置）
const startMonitor = async () => {
    // 重置请求计数
    state.requestStats = { total: 0, success: 0 };
    updateRequestStats();

    // 验证地址选择
    state.selectedSubAddresses = getSelectedAddresses();
    if (state.selectedSubAddresses.length === 0) {
        showToast('请至少选择一个二级地址');
        return;
    }

    // 验证用户信息
    const hasValidInfo = await showUserInfo();
    if (!hasValidInfo) {
        showToast('用户信息验证失败，无法启动抢单');
        return;
    }

    // 保存配置
    localStorage.setItem('threadCount', $('threadCount').value);
    localStorage.setItem('interval', $('interval').value);
    localStorage.setItem('orderLimit', $('orderLimit').value);

    // 切换到监控页面
    switchModule('monitor');
    $('orderRecords').innerHTML = '';
    $('status').textContent = '初始化监控...';

    // 启动多线程监控
    const threadCount = parseInt($('threadCount').value) || 1;
    const interval = parseInt($('interval').value) || 1000;
    state.exitFlag = false;
    state.monitorThreads = [];

    showToast(`启动抢单监控（${threadCount}线程）`);
    for (let i = 0; i < threadCount; i++) {
        const delay = (i * interval) / threadCount;
        (function(index) {
            const thread = monitorOrder(index, delay);
            state.monitorThreads.push(thread);
        })(i);
    }
};

const stopMonitor = () => {
    state.exitFlag = true;
    $('status').textContent = '已停止监控';
    showToast('抢单已停止');
};

// 查人功能
const searchDeliverers = async () => {
    const name = $('searchName').value.trim();
    try {
        setLoading(true);
        const res = await fetch(`${CONFIG.API_BASE}/api/delivery/deliverers?order_id=683ace80eb3c905760768fe2&page=1&limit=500&status=1&is_rest=2&names=${encodeURIComponent(name)}`, {
            headers: {
                'X-APPID': 'dPgKLqAyM86Wda4z',
                'X-Token': state.token,
                'X-Model': '12345',
                'X-Platform': 'android'
            },
            mode: 'cors',
            credentials: 'include'
        });
        const data = await res.json();
        const resultEl = $('searchResult');
        resultEl.innerHTML = '';

        if (data.code !== 20000) {
            resultEl.innerHTML = `<div>查询失败：${data.msg || '未知错误'}</div>`;
            return;
        }

        const items = data.data?.items || [];
        if (items.length === 0) {
            resultEl.innerHTML = '<div>未找到匹配记录</div>';
            return;
        }

        items.forEach((item, i) => {
            const div = document.createElement('div');
            div.innerHTML = `
                <div><strong>第${i + 1}条</strong></div>
                <div>ID：${item.id || '无'}</div>
                <div>昵称：${item.name || '未命名'}</div>
                <div>真实姓名：${item.real_name || '无'}</div>
                <div>联系方式：${item.mobile || '未提供'}</div>
                <div>状态：${item.status ? '在线' : '离线'}</div>
            `;
            resultEl.appendChild(div);
        });
    } catch (e) {
        showToast(`查询失败：${e.message}`);
    } finally {
        setLoading(false);
    }
};

// 自毁模式
const destroyApp = () => {
    if (confirm('确定要执行自毁吗？这将清除所有本地数据！')) {
        localStorage.clear();
        state.token = null;
        state.userInfo = null;
        showToast('自毁完成，所有数据已清除');
        switchModule('login');
        loadSavedTokens();
    }
};

// 版本检查
const checkUpdate = async () => {
    try {
        const res = await fetch(CONFIG.UPDATE_URL);
        const text = await res.text();
        const lines = text.trim().split('\n');
        if (lines.length === 0) return;

        const firstLine = lines[0].trim().toLowerCase();
        if (firstLine === 'no') {
            showToast('程序已停止使用');
            switchModule('login');
        } else if (firstLine === 'sy') {
            if (confirm('检测到自毁指令，是否执行？')) {
                destroyApp();
            }
        } else if (!isNaN(firstLine)) {
            const remoteVersion = parseInt(firstLine);
            if (remoteVersion > CONFIG.BUILTIN_VERSION) {
                showToast(`发现新版本${remoteVersion}，请更新`);
            }
        }
    } catch (e) {
        console.log('版本检查失败：', e);
    }
};

// 事件绑定
const bindEvents = () => {
    // 登录模块
    $('sendCodeBtn').addEventListener('click', sendCode);
    $('loginBtn').addEventListener('click', login);
    
    // 配置模块
    document.querySelectorAll('input[name="gender"]').forEach(radio => {
        radio.addEventListener('change', handleGenderChange);
    });
    $('selectAll').addEventListener('change', (e) => selectAllAddresses(e.target.checked));
    $('startBtn').addEventListener('click', startMonitor);
    $('backBtn').addEventListener('click', () => switchModule('login'));
    
    // 监控模块
    $('stopBtn').addEventListener('click', stopMonitor);
    $('otherFuncBtn').addEventListener('click', () => switchModule('other'));
    
    // 其他功能模块
    $('reloginBtn').addEventListener('click', () => {
        state.token = null;
        localStorage.removeItem('token');
        switchModule('login');
    });
    $('searchBtn').addEventListener('click', () => switchModule('search'));
    $('destroyBtn').addEventListener('click', destroyApp);
    $('backToMonitorBtn').addEventListener('click', () => switchModule('monitor'));
    
    // 查人模块
    $('doSearchBtn').addEventListener('click', searchDeliverers);
    $('backToOtherBtn').addEventListener('click', () => switchModule('other'));
    
    // 悬浮球点击事件
    const floatingBall = $('floatingBall');
    floatingBall.addEventListener('click', (e) => {
        // 获取点击位置相对于悬浮球的垂直坐标
        const rect = floatingBall.getBoundingClientRect();
        const clickY = e.clientY - rect.top;
        const ballHeight = floatingBall.offsetHeight;

        // 上半部分（重新登录）
        if (clickY < ballHeight / 2) {
            showToast('重新登录中...');
            state.token = null;
            localStorage.removeItem('token');
            switchModule('login');
        } 
        // 下半部分（跳转抢单配置）
        else {
            showToast('跳转到抢单配置');
            switchModule('config');
            initConfigModule(); // 刷新配置页信息
        }
    });
};

// 初始化
const init = async () => {
    bindEvents();
    setLoading(true);

    try {
        // 检查Token有效性
        if (state.token) {
            const isValid = await verifyToken(state.token);
            if (isValid) {
                switchModule('config');
                initConfigModule();
            } else {
                localStorage.removeItem('token');
                state.token = null;
                switchModule('login');
            }
        } else {
            switchModule('login');
        }
        loadSavedTokens();
        checkUpdate();
    } catch (e) {
        console.error('初始化失败:', e);
        showToast('初始化失败，请刷新页面重试');
        switchModule('login');
    } finally {
        setLoading(false);
    }
};

// 启动应用
init();
