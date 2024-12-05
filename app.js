const API_KEY = 'AIzaSyDPlWDQk5_nmm8Bqhwjyxx9k2pGL53UQqg';

let recommendedChannels = [];
let lastSearchResults = new Set();  //Set 的特點是元素不重複

const channelCache = new Map();
const cacheTimestamps = new Map();
const CACHE_DURATION = 30 * 60 * 1000; // 30分鐘的緩存時間

// 新增用於追蹤已使用搜索詞的 Map
const usedSearchQueries = new Map(); // key: cacheKey, value: Set of used queries (時間戳被包在value裡)
const USED_QUERIES_RESET_DURATION = 30 * 60 * 1000; // 30分鐘後重置已用搜索詞

function loadGoogleAPI() {
    gapi.load('client', initClient);
}

// 使用 async 關鍵字宣告非同步函數
async function initClient() {
    // 設定物件
    const initConfig = {
        apiKey: API_KEY,
        discoveryDocs: ["https://www.googleapis.com/discovery/v1/apis/youtube/v3/rest"]
    };

    try {
        // 等待 API 初始化完成
        await gapi.client.init(initConfig);
        console.log('Google API client initialized');
        setupEventListeners();
    } catch (error) {
        // 錯誤處理
        console.error('Error initializing Google API client', error);
        showError('初始化Google API時出錯。請刷新頁面重試。');
    }
}

function setupEventListeners() {
    document.getElementById('recommendForm').addEventListener('submit', function (e) {
        e.preventDefault();
        if (validateForm()) {
            searchChannels();
        }
    });

    document.querySelector('.close-modal').addEventListener('click', closeModal);

    window.addEventListener('click', function (event) {
        if (event.target == document.getElementById('channelDetailsModal')) {
            closeModal();
        }
    });
}

function validateForm() {
    const category = document.getElementById('category').value;
    const language = document.getElementById('language').value;

    if (!category && !language) {
        showError('請選擇一個類別或語言。');
        return false;
    }
    if (!language) {
        showError('請選擇一種語言。');
        return false;
    }
    if (!category) {
        showError('請選擇一種類別。');
        return false;
    }
    return true;
}

function closeModal() {
    document.getElementById('channelDetailsModal').classList.add('hidden');
}

function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

function englishToChinese(category) {
    const chineseDict = {
        'gaming': ['遊戲'],
        'music': ['音樂'],
        'technology': ['科技'],
        'lifestyle': ['生活方式'],
        'news': ['新聞和政治'],
        'sports': ['運動'],
        'arts': ['藝術和創意'],
        'business': ['商業和金融'],
        'health': ['健康和醫療'],
        'entertainment' : ['娛樂']
    }

    return chineseDict[category][0];
}

function getYouTubeSearchQueries(category, language) {
    const searchTemplates = {
        'zh-TW': {
            categories: {
                'gaming': [
                    '第一人稱射擊', '多人線上', '即時戰略', '動作冒險', '角色扮演',
                    '格鬥對戰', '卡牌對戰', '賽車競速', '3A', '生存冒險', 
                    '恐怖驚悚', '模擬經營', '益智解謎', '音樂節奏', '策略戰棋',
                    '沙盒建造', '開放世界', '回合制', '橫向捲軸', '塔防'
                ],
                'music': [
                    '流行音樂', '嘻哈饒舌', '搖滾重金屬', '電子舞曲', '古典交響',
                    '爵士藍調', '民謠抒情', '說唱饒舌', '現場演唱', '歌劇音樂劇',
                    '管弦樂團', '合唱團', '獨奏會', '音樂創作', '樂器演奏',
                    '音樂製作', '現場直播', '音樂教學', '音樂評論', '音樂賞析'
                ],
                'technology': [
                    '智慧手機', '平板電腦', '筆記型電腦', '桌上型電腦', '智慧手錶',
                    '無線耳機', '藍牙喇叭', '智慧音箱', '行動電源', '充電器',
                    '機械鍵盤', '電競滑鼠', '固態硬碟', '記憶體', '顯示卡',
                    '處理器', '主機板', '散熱器', '電源供應器', '螢幕'
                ],
                'lifestyle': [
                    '中式料理', '日式料理', '韓式料理', '義式料理', '法式料理',
                    '家常菜', '甜點烘焙', '火鍋燒烤', '小吃夜市', '素食蔬食',
                    '養生保健', '咖啡沖煮', '下午茶', '居家裝潢', '寵物照顧',
                    '戶外露營', '旅遊規劃', '美妝保養', '穿搭時尚', '運動健身'
                ],
                'news': [
                    '政治新聞', '財經新聞', '社會新聞', '國際新聞', '科技新聞',
                    '體育新聞', '娛樂新聞', '生活新聞', '氣象新聞', '交通新聞',
                    '地方新聞', '產業新聞', '醫療新聞', '教育新聞', '環保新聞',
                    '司法新聞', '軍事新聞', '文化新聞', '農業新聞', '影視新聞'
                ],
                'sports': [
                    '職業籃球', '職業棒球', '職業足球', '職業排球', '職業網球',
                    '奧運比賽', '世界盃賽', '亞運比賽', '全運會', '馬拉松',
                    '鐵人三項', '極限運動', '格鬥競技', '健身訓練', '瑜珈冥想',
                    '武術格鬥', '游泳戲水', '球類運動', '自行車', '登山健行'
                ],
                'arts': [
                    '人像攝影', '風景攝影', '商業攝影', '紀實攝影', '街頭攝影',
                    '水彩繪畫', '油畫創作', '素描技法', '國畫水墨', '書法篆刻',
                    '雕塑塑型', '陶藝製作', '金工創作', '版畫印刷', '插畫設計',
                    '建築設計', '室內設計', '平面設計', '動畫製作', '影視後製'
                ],
                'business': [
                    '股票投資', '基金投資', '期貨交易', '外匯交易', '債券買賣',
                    '房地產投資', '創業管理', '電子商務', '品牌經營', '財務規劃',
                    '稅務申報', '資產配置', '風險管理', '投資理財', '數位金融',
                    '商業保險', '退休規劃', '股市分析', '經濟趨勢', '產業分析'
                ],
                'health': [
                    '心臟內科', '腸胃內科', '神經內科', '胸腔內科', '骨科',
                    '眼科視力', '牙科矯正', '婦產科', '小兒科', '皮膚科',
                    '耳鼻喉科', '精神心理', '復健科', '營養保健', '中醫養生',
                    '減重瘦身', '運動康復', '疾病預防', '健康檢查', '醫療保健'
                ],
                'entertainment': [
                    '電影', '連續劇', '綜藝節目', '動畫', '動漫',
                    '韓劇', '日劇', '美劇', '大陸劇', '台劇',
                    '脫口秀', '舞台劇','街舞', '魔術', '雜技', 
                    '馬戲', '明星', '演員', '表演', '誹聞', '娛樂週刊'
                ]
            },
            regionMarker: ['中文']
        },
    
        'en-US': {
            categories: {
                'gaming': [
                    'fps games', 'moba games', 'mmorpg', 'battle royale', 'rpg',
                    'platformer', 'roguelike', 'hack and slash', 'souls like', 'metroidvania',
                    'pvp', 'pve', 'co-op', 'speedrun', 'esports',
                    'single player', 'multiplayer', 'controller', 'achievements', 'dlc'
                ],
                'music': [
                    'indie music', 'lofi', 'kpop', 'metal', 'edm',
                    'rock', 'punk', 'house music', 'drum and bass', 'techno',
                    'dubstep', 'classical', 'acoustic', 'instrumental', 'mixtape',
                    'vinyl', 'playlist', 'charts', 'concert', 'festival'
                ],
                'technology': [
                    'smartphone', 'tablet', 'laptop', 'desktop', 'smartwatch',
                    'wireless earbuds', 'bluetooth speaker', 'smart speaker', 'power bank', 'charger',
                    'mechanical keyboard', 'gaming mouse', 'ssd', 'ram', 'gpu',
                    'cpu', 'motherboard', 'cooling', 'power supply', 'monitor'
                ],
                'lifestyle': [
                    'workout', 'meal prep', 'skincare', 'makeup', 'fashion',
                    'home decor', 'gardening', 'cooking', 'recipes', 'diy',
                    'morning routine', 'cleaning', 'minimalism', 'sustainability', 'zero waste',
                    'thrifting', 'self care', 'meditation', 'productivity', 'mindfulness'
                ],
                'news': [
                    'breaking news', 'headlines', 'fact check', 'live updates', 'press conference',
                    'election', 'politics', 'world news', 'climate change', 'economy',
                    'stock market', 'pandemic', 'crime', 'local news', 'trending',
                    'viral', 'controversy', 'investigation', 'analysis', 'opinion'
                ],
                'sports': [
                    'basketball', 'baseball', 'football', 'volleyball', 'tennis',
                    'olympics', 'world cup', 'championship', 'marathon', 'triathlon',
                    'extreme sports', 'combat sports', 'training', 'yoga', 'martial arts',
                    'swimming', 'ball games', 'cycling', 'hiking', 'climbing'
                ],
                'arts': [
                    'photography', 'digital art', 'graphic design', 'illustration', 'painting',
                    'drawing', '3d modeling', 'concept art', 'character design', 'pixel art',
                    'animation', 'motion graphics', 'typography', 'logo design', 'web design',
                    'art gallery', 'artist studio', 'art supplies', 'commission', 'portfolio'
                ],
                'business': [
                    'stocks', 'trading', 'investment', 'finance', 'banking',
                    'real estate', 'startup', 'small business', 'ecommerce', 'marketing',
                    'business plan', 'management', 'leadership', 'entrepreneurship', 'strategy',
                    'analytics', 'consulting', 'sales', 'operations', 'hr'
                ],
                'health': [
                    'workout', 'gym', 'fitness', 'nutrition', 'diet',
                    'mental health', 'anxiety', 'depression', 'therapy', 'meditation',
                    'yoga', 'mindfulness', 'supplements', 'vitamins', 'protein',
                    'weight loss', 'meal prep', 'healthy lifestyle', 'wellness', 'recovery'
                ],
                'entertainment': [
                    'movies', 'tv shows', 'series', 'drama', 'anime',
                    'streaming', 'podcast', 'review', 'trailer', 'documentary',
                    'interview', 'behind scenes', 'reality show', 'talk show',
                    'comedy', 'musical', 'theater', 'performance', 'live show'
                ]
            },
            regionMarker: ['english']
        }
    };

    const searchQueries = new Set();
    const templates = searchTemplates[language];

    if (!templates?.categories[category]) {
        return [];
    }

    try {
        const categoryName = language === 'zh-TW' ? englishToChinese(category) : category;
        const specificTerms = templates.categories[category];
        const currentYear = new Date().getFullYear();
        const regionMarker = templates.regionMarker;

        // 1. 基本關鍵字（加入語言標記）
        searchQueries.add(`${categoryName} ${regionMarker}`);

        // 2. 特定詞組合
        specificTerms.forEach(term => {
            // 類別 + 特定詞
            searchQueries.add(`${categoryName} ${term} ${regionMarker}`);
        });

        // 打印生成的所有搜索詞，用於調試
        console.log(`生成的搜索詞：\n`);
        console.log(Array.from(searchQueries).join('\n'));

        return shuffleArray(Array.from(searchQueries));

    } catch (error) {
        console.error('搜尋查詢生成錯誤:', error);
        return [];
    }
}

// 頻道評分系統
function calculateChannelScore(channel, channelStats) {
    try {
        const weights = {
            subscribers: 0.3,   // 訂閱數權重
            views: 0.3,         // 觀看數權重
            engagement: 0.4     // 互動率權重(提高權重因為這更能反映頻道活躍度)
        };

        // 計算訂閱者分數 (最高100分)
        const subscriberScore = calculateSubscriberScore(channelStats.subscriberCount);

        // 計算觀看次數分數 (最高100分)
        const viewScore = calculateViewScore(channelStats.viewCount);

        // 計算互動率分數 (最高100分)
        const engagementScore = calculateEngagementScore(channelStats);

        // 計算總分
        const totalScore = Math.round(
            subscriberScore * weights.subscribers +
            viewScore * weights.views +
            engagementScore * weights.engagement
        );

        return {
            total: totalScore,
            subscribers: Math.round(subscriberScore),
            views: Math.round(viewScore),
            engagement: Math.round(engagementScore)  // 改為 engagement
        };

    } catch (error) {
        console.error('計算頻道分數時出錯:', error);
        return {
            total: 0,
            subscribers: 0,
            views: 0,
            engagement: 0
        };
    }
}

// 計算頻道總訂閱數分數
function calculateSubscriberScore(subscriberCount) {
    // 輸入值檢查
    if (!subscriberCount || subscriberCount === 'N/A') return 0;

    // 防止負數和極大值 (設定上限為5億)
    const count = Math.max(0, Math.min(parseInt(subscriberCount), 500000000));

    // 設定最小閾值 (1000訂閱)
    const minThreshold = 1000;
    if (count < minThreshold) {
        return Math.round((count / minThreshold) * 20); // 低於門檻最高只能得到20分
    }

    // 重新設計分段:
    // 1. 1K-100K: 20-40分 (小型頻道)
    // 2. 100K-1M: 40-60分 (中型頻道)
    // 3. 1M-10M: 60-80分 (大型頻道)
    // 4. 10M-50M: 80-90分 (超大型頻道)
    // 5. 50M-200M: 90-95分 (頂級頻道)
    // 6. 200M以上: 95-100分 (世界級頻道)

    if (count < 100000) {            //10萬 - 1000
        return 20 + Math.round((count - 1000) / (100000 - 1000) * 20);
    } else if (count < 1000000) {    //100萬 - 10萬
        return 40 + Math.round((count - 100000) / (1000000 - 100000) * 20);
    } else if (count < 10000000) {   //1000萬 - 100萬
        return 60 + Math.round((count - 1000000) / (10000000 - 1000000) * 20);
    } else if (count < 50000000) {   //5000萬 - 1000萬
        return 80 + Math.round((count - 10000000) / (50000000 - 10000000) * 10);
    } else if (count < 200000000) {  //2億 - 5000萬
        return 90 + Math.round((count - 50000000) / (200000000 - 50000000) * 5);
    } else {                         //5億 - 2億
        return 95 + Math.round((count - 200000000) / (500000000 - 200000000) * 5);
    }
}

// 計算頻道總觀看次數分數
function calculateViewScore(viewCount) {
    // 輸入值檢查
    if (!viewCount || viewCount === 'N/A') return 0;

    // 防止負數和極大值 (設定上限為3000億觀看)
    const count = Math.max(0, Math.min(parseInt(viewCount), 300000000000));

    // 設定最小閾值 (1萬次觀看)
    const minThreshold = 10000;
    if (count < minThreshold) {
        return Math.round((count / minThreshold) * 30); // 低於門檻最高只能得到30分
    }

    // 分段計算:
    // 1. 1萬-1000萬: 30-45分 (新頻道/小頻道)
    // 2. 1000萬-1億: 45-60分 (成長中的頻道)
    // 3. 1億-10億: 60-75分 (成功頻道)
    // 4. 10億-100億: 75-85分 (大型頻道)
    // 5. 100億-1000億: 85-95分 (超級頻道)
    // 6. 1000億以上: 95-100分 (世界級頻道)

    if (count < 10000000) {            // 1000萬 - 1萬
        return 30 + Math.round((count - 10000) / (10000000 - 10000) * 15);
    } else if (count < 100000000) {    // 1億 - 1000萬
        return 45 + Math.round((count - 10000000) / (100000000 - 10000000) * 15);
    } else if (count < 1000000000) {   // 10億 - 1億
        return 60 + Math.round((count - 100000000) / (1000000000 - 100000000) * 15);
    } else if (count < 10000000000) {  // 100億 - 10億
        return 75 + Math.round((count - 1000000000) / (10000000000 - 1000000000) * 10);
    } else if (count < 100000000000) { // 1000億 - 100億
        return 85 + Math.round((count - 10000000000) / (100000000000 - 10000000000) * 10);
    } else {                           // 3000億 - 1000億
        return 95 + Math.round((count - 100000000000) / (300000000000 - 100000000000) * 5);
    }
}

function calculateEngagementScore(channelStats) {
    if (!channelStats) return 0;

    const { viewCount, subscriberCount, commentCount, videoCount } = channelStats;

    if (!viewCount || !subscriberCount || !videoCount) return 0;

    // 防止極端值
    const safeViewCount = Math.max(1, Math.min(parseInt(viewCount), 10000000000));
    const safeSubscriberCount = Math.max(0, Math.min(parseInt(subscriberCount), 1000000000));
    const safeVideoCount = Math.max(1, Math.min(parseInt(videoCount), 100000));
    const safeCommentCount = commentCount ? Math.max(0, Math.min(parseInt(commentCount), safeViewCount)) : 0;

    // 計算每影片平均觀看數
    const viewsPerVideo = Math.round(safeViewCount / safeVideoCount);

    // 計算互動指標
    const subPerVideo = Math.round(safeSubscriberCount / safeVideoCount); // 每影片平均訂閱
    const commentPerVideo = Math.round(safeCommentCount / safeVideoCount); // 每影片平均留言

    // 1. 計算每影片觀看分數 (佔比20%)
    const getViewsPerVideoScore = (count) => {
        // 設定最小閾值 (100觀看/影片)
        const minThreshold = 100;
        if (count < minThreshold) {
            return Math.round((count / minThreshold) * 20); // 低於門檻最高20分
        }

        // 分段計算：
        //    平均觀看    分數
        // 1. 100-1000: 20-40分 (小型影片)
        // 2. 1000-10000: 40-60分 (一般影片)
        // 3. 10000-100000: 60-80分 (熱門影片)
        // 4. 100000-500000: 80-90分 (超熱門影片)
        // 5. 500000-1000000: 90-95分 (viral影片)
        // 6. 1000000以上: 95-100分 (現象級影片)

        if (count < 1000) {
            return 20 + Math.round((count - 100) / 900 * 20);
        } else if (count < 10000) {
            return 40 + Math.round((count - 1000) / 9000 * 20);
        } else if (count < 100000) {
            return 60 + Math.round((count - 10000) / 90000 * 20);
        } else if (count < 500000) {
            return 80 + Math.round((count - 100000) / 400000 * 10);
        } else if (count < 1000000) {
            return 90 + Math.round((count - 500000) / 500000 * 5);
        } else {
            return 95 + Math.round((count - 1000000) / 1000000 * 5);
        }
    };

    // 2. 計算每影片訂閱分數 (佔比40%)
    const getSubsPerVideoScore = (count) => {
        // 設定最小閾值 (1訂閱/影片)
        const minThreshold = 1;
        if (count < minThreshold) {
            return 0;
        }

        // 分段計算：
        //  轉換率    分數
        // 1. 1-10: 20-40分 (基本轉換)
        // 2. 10-100: 40-60分 (良好轉換)
        // 3. 100-1000: 60-80分 (優秀轉換)
        // 4. 1000-5000: 80-90分 (傑出轉換)
        // 5. 5000-10000: 90-95分 (驚人轉換)
        // 6. 10000以上: 95-100分 (現象級轉換)

        if (count < 10) {
            return 20 + Math.round((count - 1) / 9 * 20);
        } else if (count < 100) {
            return 40 + Math.round((count - 10) / 90 * 20);
        } else if (count < 1000) {
            return 60 + Math.round((count - 100) / 900 * 20);
        } else if (count < 5000) {
            return 80 + Math.round((count - 1000) / 4000 * 10);
        } else if (count < 10000) {
            return 90 + Math.round((count - 5000) / 5000 * 5);
        } else {
            return 95 + Math.round((count - 10000) / 10000 * 5);
        }
    };

    // 3. 計算每影片留言分數 (佔比40%)
    const getCommentsPerVideoScore = (count) => {
        // 設定最小閾值 (1留言/影片)
        const minThreshold = 1;
        if (count < minThreshold) {
            return 0;
        }

        // 分段計算：
        //  評論數    分數
        // 1. 1-10: 20-40分 (基本互動)
        // 2. 10-50: 40-60分 (良好互動)
        // 3. 50-200: 60-80分 (活躍互動)
        // 4. 200-1000: 80-90分 (熱烈互動)
        // 5. 1000-2000: 90-95分 (超高互動)
        // 6. 2000以上: 95-100分 (現象級互動)

        if (count < 10) {
            return 20 + Math.round((count - 1) / 9 * 20);
        } else if (count < 50) {
            return 40 + Math.round((count - 10) / 40 * 20);
        } else if (count < 200) {
            return 60 + Math.round((count - 50) / 150 * 20);
        } else if (count < 1000) {
            return 80 + Math.round((count - 200) / 800 * 10);
        } else if (count < 2000) {
            return 90 + Math.round((count - 1000) / 1000 * 5);
        } else {
            return 95 + Math.round((count - 2000) / 2000 * 5);
        }
    };

    // 計算各項分數
    const viewsScore = getViewsPerVideoScore(viewsPerVideo);
    const subsScore = getSubsPerVideoScore(subPerVideo);
    const commentScore = getCommentsPerVideoScore(commentPerVideo);

    // 加權計算總分
    const totalScore = (viewsScore * 0.2) + (subsScore * 0.4) + (commentScore * 0.4);

    return Math.round(Math.max(0, Math.min(100, totalScore)));
}

async function searchChannels() {
    if (!validateForm()) {
        return;
    }

    const category = document.getElementById('category').value;
    const language = document.getElementById('language').value;
    const regionCode = language.split('-')[1];

    // 創建緩存
    const cacheKey = `${category}_${language}`;
    const now = Date.now();

    showLoader();

    try {
        let newChannels = [];

        const cacheTimestamp = cacheTimestamps.get(cacheKey);
        const isCacheValid = cacheTimestamp && (now - cacheTimestamp) < CACHE_DURATION;

        // 檢查並初始化該類別的已用搜索詞集合
        if (usedSearchQueries.has(cacheKey) == 0) {
            usedSearchQueries.set(cacheKey, {
                queries: new Set(),
                timestamp: now
            });
        }

        // 檢查搜索詞是否過期
        const queryTracker = usedSearchQueries.get(cacheKey);
        if (now - queryTracker.timestamp > USED_QUERIES_RESET_DURATION) {
            queryTracker.queries.clear();
            queryTracker.timestamp = now;
            console.log('搜索詞過期，重置已用搜索詞記錄');
        }

        console.log('緩存狀態檢查:', {
            '緩存是否有效': isCacheValid,
            '緩存是否存在': channelCache.has(cacheKey),
            '當前緩存數量': channelCache.has(cacheKey) ? channelCache.get(cacheKey).length : 0,
            '緩存有效期': cacheTimestamp ? `${Math.floor((CACHE_DURATION - (now - cacheTimestamp)) / 1000)}秒` : '無緩存',
            '已用搜索詞數量': queryTracker.queries.size
        });

        if (isCacheValid &&
            channelCache.has(cacheKey) &&
            channelCache.get(cacheKey).length >= 6) {
            newChannels = channelCache.get(cacheKey);
            console.log('使用緩存數據:', {
                '可用頻道數量': newChannels.length,
                '已記錄頻道數量': lastSearchResults.size
            });
        } else {
            let searchReason;
            if (!channelCache.has(cacheKey)) {
                searchReason = '無緩存';
            } else if (!isCacheValid) {
                channelCache.delete(cacheKey);
                cacheTimestamps.delete(cacheKey);
                searchReason = '緩存無效';
            } else {
                searchReason = '緩存數量不足';
            }

            console.log('開始新搜索:', {
                '原因': searchReason,
                '緩存狀態': {
                    '是否有效': isCacheValid,
                    '是否存在': channelCache.has(cacheKey),
                    '當前數量': channelCache.has(cacheKey) ? channelCache.get(cacheKey).length : 0
                }
            });

            const searchQueries = getYouTubeSearchQueries(category, language);
            let attempts = 0;
            const MAX_ATTEMPTS = 3;

            // 獲取未使用的搜索詞
            const getUnusedQuery = () => {
                const unusedQueries = searchQueries.filter(query =>
                    !queryTracker.queries.has(query)
                );

                if (unusedQueries.length === 0) {
                    console.log('所有搜索詞已用完,重置搜索詞記錄');
                    queryTracker.queries.clear();
                    queryTracker.timestamp = now;
                    return searchQueries[Math.floor(Math.random() * searchQueries.length)];
                }

                return unusedQueries[Math.floor(Math.random() * unusedQueries.length)];
            };

            while (attempts < MAX_ATTEMPTS) {

                const randomQuery = getUnusedQuery();
                queryTracker.queries.add(randomQuery); // 記錄使用過的搜索詞

                console.log(`搜索嘗試 ${attempts + 1}/${MAX_ATTEMPTS}:`, {
                    '搜索詞': randomQuery,
                    '當前頻道數': attempts == 0 ? (channelCache.get(cacheKey)?.length || 0) : newChannels.length,
                    '已用搜索詞數量': queryTracker.queries.size
                });

                const response = await gapi.client.youtube.search.list({
                    part: 'snippet',
                    type: 'channel',
                    q: randomQuery,
                    relevanceLanguage: language.split('-')[0],
                    regionCode: regionCode,
                    maxResults: 50,
                    pageToken: getRandomPageToken(),
                    safeSearch: 'none'
                });

                const filteredChannels = response.result.items.filter(channel =>
                    !lastSearchResults.has(channel.id.channelId) &&
                    !newChannels.some(existingChannel =>
                        existingChannel.id.channelId === channel.id.channelId
                    )
                );

                console.log('API回應過濾結果:', {
                    'API返回數量': response.result.items.length,
                    '過濾後數量': filteredChannels.length,
                    '被過濾原因': {
                        '已在歷史記錄': response.result.items.filter(channel =>
                            lastSearchResults.has(channel.id.channelId)).length,
                        '重複頻道': response.result.items.filter(channel =>
                            newChannels.some(existing => existing.id.channelId === channel.id.channelId)).length,
                        'newChannels': newChannels
                    }
                });

                if (attempts == 0 && channelCache.get(cacheKey)) {
                    const existingChannels = channelCache.get(cacheKey) || [];
                    newChannels = [...existingChannels, ...filteredChannels];
                } else {
                    newChannels = [...newChannels, ...filteredChannels];
                }

                attempts++;

                if (newChannels.length >= 6) {
                    console.log('更新緩存:', {
                        '總頻道數': newChannels.length,
                        '累計搜索次數': attempts,
                        '已用搜索詞數量': queryTracker.queries.size
                    });
                    //會覆蓋舊值
                    channelCache.set(cacheKey, newChannels);
                    cacheTimestamps.set(cacheKey, now);
                    break;
                }

                if (newChannels.length < 6 && attempts < MAX_ATTEMPTS) {
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
            }

            // 備用搜索
            if (newChannels.length < 6) {
                console.log('啟動備用搜索:', {
                    '當前頻道數': newChannels.length,
                    '歷史記錄數': lastSearchResults.size,
                    '已用搜索詞數量': queryTracker.queries.size,
                    '總搜索詞數量': searchQueries.length,
                    '剩餘未用詞數': searchQueries.length - queryTracker.queries.size
                });

                // 清空歷史頻道記錄
                lastSearchResults.clear();
                console.log('已清空歷史頻道記錄');

                const randomQuery = getUnusedQuery();
                queryTracker.queries.add(randomQuery); // 記錄使用過的搜索詞

                console.log('備用搜索使用搜索詞:', {
                    '搜索詞': randomQuery,
                    '已用搜索詞數量': queryTracker.queries.size,
                    '剩餘未用搜索詞數量': searchQueries.length - queryTracker.queries.size,
                    '是否為重置後首次使用': queryTracker.queries.size === 1
                });

                try {
                    const finalResponse = await gapi.client.youtube.search.list({
                        part: 'snippet',
                        type: 'channel',
                        q: randomQuery,
                        relevanceLanguage: language.split('-')[0],
                        regionCode: regionCode,
                        maxResults: 50,
                        pageToken: getRandomPageToken()
                    });

                    newChannels = finalResponse.result.items;

                    console.log('備用搜索結果:', {
                        '獲取頻道數': newChannels.length,
                        '搜索詞': randomQuery,
                        '當前搜索詞進度': `${queryTracker.queries.size}/${searchQueries.length}`,
                        '是否為重置後搜索': queryTracker.queries.size === 1
                    });

                    if (newChannels.length > 0) {
                        channelCache.set(cacheKey, newChannels);
                        cacheTimestamps.set(cacheKey, now);
                        console.log('更新備用搜索緩存:', {
                            '緩存頻道數': newChannels.length,
                            '緩存時間': new Date(now).toLocaleString()
                        });
                    }
                } catch (error) {
                    console.error('備用搜索錯誤:', {
                        '搜索詞': randomQuery,
                        '錯誤': error.message,
                        '搜索詞使用狀態': `${queryTracker.queries.size}/${searchQueries.length}`
                    });
                }
            }
        }

        // 為每個頻道計算分數
        for (const channel of newChannels) {
            const stats = await getChannelStats(channel.id.channelId);
            // 屬性動態添加
            channel.score = calculateChannelScore(channel, stats);
        }

        // 根據總分排序
        newChannels.sort((a, b) => b.score.total - a.score.total);

        // 選擇分數最高的6個頻道
        recommendedChannels = newChannels.slice(0, 6);

        console.log('推薦結果:', {
            '推薦頻道數': recommendedChannels.length,
            '剩餘可用頻道': newChannels.length - recommendedChannels.length,
            '已用搜索詞數量': queryTracker.queries.size
        });

        recommendedChannels.forEach(channel => {
            lastSearchResults.add(channel.id.channelId);

            if (channelCache.has(cacheKey)) {
                const cachedChannels = channelCache.get(cacheKey);
                const updatedCache = cachedChannels.filter(
                    cachedChannel => cachedChannel.id.channelId !== channel.id.channelId
                );
                channelCache.set(cacheKey, updatedCache);
            }
        });

        console.log('更新後狀態:', {
            '緩存中剩餘頻道': channelCache.has(cacheKey) ? channelCache.get(cacheKey).length : 0,
            '歷史記錄數量': lastSearchResults.size,
            '已用搜索詞數量': queryTracker.queries.size
        });

        if (recommendedChannels.length === 0) {
            document.getElementById('recommendResults').innerHTML =
                '<p class="text-center text-gray-600">沒有找到匹配的頻道。請嘗試不同的類別或語言。</p>';
        } else {
            await displayRecommendations(recommendedChannels);
        }

    } catch (error) {
        console.error('搜索錯誤:', error);
        showError('搜索頻道時出錯。請稍後再試。');
        channelCache.delete(cacheKey);
        cacheTimestamps.delete(cacheKey);
    } finally {
        hideLoader();
    }
}

// 隨機生成 pageToken
function getRandomPageToken() {
    // YouTube API 的 pageToken 通常基於某些規則生成
    // 這裡我們簡單地隨機返回 undefined 或 空字符串，讓 API 自己處理
    return Math.random() > 0.5 ? undefined : '';
}

async function displayRecommendations(channels) {
    const resultsContainer = document.getElementById('recommendResults');
    resultsContainer.innerHTML = '';

    for (const channel of channels) {
        const channelCard = await createChannelCard(channel);
        resultsContainer.appendChild(channelCard);
    }
}

async function createChannelCard(channel) {
    const card = document.createElement('div');
    card.className = 'bg-white rounded-lg shadow-md overflow-hidden relative channel-card';

    let channelStats;
    try {
        channelStats = await getChannelStats(channel.id.channelId);
    } catch (error) {
        console.error('Error fetching channel stats:', error);
        channelStats = { subscriberCount: 'N/A' };
    }

    // 獲取評分標籤的背景顏色
    const getScoreColor = (score) => {
        if (score >= 80) return 'bg-green-500';
        if (score >= 60) return 'bg-blue-500';
        return 'bg-gray-500';
    };

    card.innerHTML = `
        <div class="absolute top-2 right-2 ${getScoreColor(channel.score.total)} text-white px-2 py-1 rounded-full text-sm font-bold">
            ${channel.score.total}分
        </div>
        <img src="${channel.snippet.thumbnails.medium.url}" alt="${channel.snippet.title}" class="w-full h-48 object-cover">
        <div class="p-4">
            <h3 class="font-bold text-lg mb-2">${channel.snippet.title}</h3>
            <p class="text-gray-700 text-sm mb-4">${channel.snippet.description}</p>
            <p class="text-gray-600 text-sm mb-4">訂閱數: ${formatNumber(channelStats.subscriberCount)}</p>
            <div class="mt-2 text-sm text-gray-500">
                <span class="mr-2">訂閱: ${channel.score.subscribers}</span>
                <span class="mr-2">觀看: ${channel.score.views}</span>
                <span>互動: ${channel.score.engagement}</span>
            </div>
        </div>
        <button class="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded channel-details-btn absolute bottom-4 left-4" data-channel-id="${channel.id.channelId}">
            頻道詳情
        </button>
    `;

    card.querySelector('.channel-details-btn').addEventListener('click', (e) => showChannelDetails(e.target.dataset.channelId));

    return card;
}

async function getChannelStats(channelId) {
    try {
        const response = await gapi.client.youtube.channels.list({
            part: 'statistics',
            id: channelId
        });
        return response.result.items[0].statistics;
    } catch (error) {
        console.error('Error fetching channel stats:', error);
        return { subscriberCount: 'N/A' };
    }
}

async function showChannelDetails(channelId) {
    showLoader();

    try {
        const channelResponse = await gapi.client.youtube.channels.list({
            part: 'snippet,statistics,brandingSettings',
            id: channelId
        });
        const channel = channelResponse.result.items[0];

        if (!channel) {
            throw new Error('Channel not found');
        }

        const videosResponse = await gapi.client.youtube.search.list({
            part: 'snippet',
            channelId: channelId,
            order: 'viewCount',
            type: 'video',
            maxResults: 6
        });
        const videos = videosResponse.result.items;

        displayChannelDetails(channel, videos);
    } catch (error) {
        console.error('Error fetching channel details:', error);
        showError('獲取頻道詳情時出錯。請稍後再試。');
    } finally {
        hideLoader();
    }
}

function displayChannelDetails(channel, videos) {
    const channelInfo = document.getElementById('channelInfo');
    const topVideos = document.getElementById('topVideos');

    const bannerImageUrl = channel.brandingSettings?.image?.bannerExternalUrl ||
        channel.snippet.thumbnails.medium.url;

    const channelHtml = `
        <div class="text-center mb-4">
            ${bannerImageUrl ? `<img src="${bannerImageUrl}" alt="${channel.snippet?.title || ''}" class="w-full h-32 object-cover mb-3">` : ''}
            <img src="${channel.snippet?.thumbnails?.medium?.url || ''}" alt="${channel.snippet?.title || ''}" class="rounded-full mx-auto mb-3" style="width: 100px; height: 100px;">
            <h2 class="text-2xl font-bold">${channel.snippet?.title || 'No Title'}</h2>
            <p class="text-gray-700 mt-2">${channel.snippet?.description || 'No Description'}</p>
            <p class="mt-2"><strong>訂閱數:</strong> ${formatNumber(channel.statistics?.subscriberCount)}</p>
            <p><strong>總觀看次數:</strong> ${formatNumber(channel.statistics?.viewCount)}</p>
            <a href="https://www.youtube.com/channel/${channel.id}" target="_blank" class="mt-4 inline-block bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded">
                瀏覽頻道
            </a>
        </div>
    `;

    channelInfo.innerHTML = channelHtml;

    topVideos.innerHTML = videos.map((video, index) => `
        <div class="bg-white rounded shadow-md overflow-hidden relative">
            ${index < 3 ? `<div class="absolute top-0 left-0 bg-yellow-400 text-white px-2 py-1 text-sm font-bold">Top ${index + 1}</div>` : ''}
            <a href="https://www.youtube.com/watch?v=${video.id.videoId}" target="_blank">
                <img src="${video.snippet.thumbnails.medium.url}" alt="${video.snippet.title}" class="w-full h-32 object-cover">
                <div class="p-2">
                    <p class="font-semibold text-sm">${video.snippet.title}</p>
                </div>
            </a>
        </div>
    `).join('');

    document.getElementById('channelDetailsModal').classList.remove('hidden');
}

function formatNumber(num) {
    return num ? num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",") : 'N/A';
}

function showLoader() {
    const loader = document.createElement('div');
    loader.className = 'loader fixed top-0 left-0 w-full h-full flex items-center justify-center bg-gray-900 bg-opacity-50 z-50';
    loader.innerHTML = '<div class="animate-spin rounded-full h-32 w-32 border-t-2 border-b-2 border-blue-500"></div>';
    document.body.appendChild(loader);
}

function hideLoader() {
    const loader = document.querySelector('.loader');
    if (loader) {
        loader.remove();
    }
}

function showError(message) {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4';
    errorDiv.innerHTML = `
        <strong class="font-bold">錯誤!</strong>
        <span class="block sm:inline">${message}</span>
        <span class="absolute top-0 bottom-0 right-0 px-4 py-3">
            <svg class="fill-current h-6 w-6 text-red-500" role="button" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><title>關閉</title><path d="M14.348 14.849a1.2 1.2 0 0 1-1.697 0L10 11.819l-2.651 3.029a1.2 1.2 0 1 1-1.697-1.697l2.758-3.15-2.759-3.152a1.2 1.2 0 1 1 1.697-1.697L10 8.183l2.651-3.031a1.2 1.2 0 1 1 1.697 1.697l-2.758 3.152 2.758 3.15a1.2 1.2 0 0 1 0 1.698z"/></svg>
        </span>
    `;
    document.body.insertBefore(errorDiv, document.body.firstChild);

    errorDiv.querySelector('svg').addEventListener('click', () => errorDiv.remove());

    setTimeout(() => {
        errorDiv.remove();
    }, 5000);
}

window.onload = loadGoogleAPI;