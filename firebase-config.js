// Firebase 구성 및 유틸리티 함수
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged, signInAnonymously } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";

// Firebase 구성 - 실제 사용 시 본인의 Firebase 프로젝트 설정으로 변경 필요
const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "your-project.firebaseapp.com",
    projectId: "your-project",
    storageBucket: "your-project.appspot.com",
    messagingSenderId: "YOUR_MESSAGING_ID",
    appId: "YOUR_APP_ID"
};

// Firebase 초기화
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// 인증 상태 변경 감지
let currentUser = null;
onAuthStateChanged(auth, (user) => {
    currentUser = user;
    if (user) {
        // 사용자가 로그인한 경우
        console.log('사용자 로그인됨:', user.uid);
        document.querySelectorAll('.user-status').forEach(el => {
            el.textContent = user.isAnonymous ? '게스트' : user.email;
        });
        document.querySelectorAll('.login-area').forEach(el => el.style.display = 'none');
        document.querySelectorAll('.user-area').forEach(el => el.style.display = 'flex');
        
        // 데이터 동기화
        syncDataWithCloud();
    } else {
        // 사용자가 로그아웃한 경우
        console.log('로그인 필요');
        document.querySelectorAll('.user-status').forEach(el => {
            el.textContent = '로그인 필요';
        });
        document.querySelectorAll('.login-area').forEach(el => el.style.display = 'flex');
        document.querySelectorAll('.user-area').forEach(el => el.style.display = 'none');
    }
});

// 익명 로그인 (게스트 모드)
async function loginAsGuest() {
    try {
        const userCredential = await signInAnonymously(auth);
        return userCredential.user;
    } catch (error) {
        console.error('익명 로그인 오류:', error.message);
        throw error;
    }
}

// 이메일/비밀번호로 로그인
async function loginWithEmail(email, password) {
    try {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        return userCredential.user;
    } catch (error) {
        console.error('로그인 오류:', error.message);
        throw error;
    }
}

// 회원가입
async function registerWithEmail(email, password) {
    try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        return userCredential.user;
    } catch (error) {
        console.error('회원가입 오류:', error.message);
        throw error;
    }
}

// 로그아웃
async function logoutUser() {
    try {
        await signOut(auth);
        console.log('로그아웃 성공');
    } catch (error) {
        console.error('로그아웃 오류:', error.message);
        throw error;
    }
}

// 데이터 저장
async function saveUserDataToCloud(userData) {
    if (!currentUser) return false;
    
    try {
        await setDoc(doc(db, "users", currentUser.uid), userData);
        console.log('클라우드에 데이터 저장 성공');
        return true;
    } catch (error) {
        console.error('클라우드 데이터 저장 오류:', error);
        return false;
    }
}

// 데이터 불러오기
async function loadUserDataFromCloud() {
    if (!currentUser) return null;
    
    try {
        const docRef = doc(db, "users", currentUser.uid);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
            console.log('클라우드에서 데이터 로드 성공');
            return docSnap.data();
        } else {
            console.log('클라우드에 데이터 없음');
            return null;
        }
    } catch (error) {
        console.error('클라우드 데이터 로드 오류:', error);
        return null;
    }
}

// 로컬 데이터와 클라우드 데이터 동기화
async function syncDataWithCloud() {
    // 로컬 데이터 불러오기
    const localData = localStorage.getItem('educationalGamesData');
    const localUserData = localData ? JSON.parse(localData) : null;
    
    // 클라우드 데이터 불러오기
    const cloudUserData = await loadUserDataFromCloud();
    
    // 데이터 병합 또는 동기화 처리
    if (cloudUserData && localUserData) {
        // 두 데이터가 모두 있는 경우, 최신 정보로 병합
        const mergedData = mergeUserData(localUserData, cloudUserData);
        localStorage.setItem('educationalGamesData', JSON.stringify(mergedData));
        await saveUserDataToCloud(mergedData);
    } else if (cloudUserData) {
        // 클라우드 데이터만 있는 경우
        localStorage.setItem('educationalGamesData', JSON.stringify(cloudUserData));
    } else if (localUserData) {
        // 로컬 데이터만 있는 경우
        await saveUserDataToCloud(localUserData);
    }
}

// 두 사용자 데이터 병합 (점수는 더 높은 것으로 유지)
function mergeUserData(localData, cloudData) {
    const result = JSON.parse(JSON.stringify(cloudData)); // 깊은 복사
    
    // 각 게임 점수 비교하여 높은 점수 사용
    if (localData.scores && result.scores) {
        for (const game in localData.scores) {
            if (localData.scores[game] > (result.scores[game] || 0)) {
                result.scores[game] = localData.scores[game];
            }
        }
    }
    
    // 배지 병합 (중복 제거)
    if (localData.badges && result.badges) {
        const badgeSet = new Set([...result.badges, ...localData.badges]);
        result.badges = Array.from(badgeSet);
    }
    
    // 총 점수 재계산
    if (result.scores) {
        result.totalScore = Object.values(result.scores).reduce((total, score) => total + score, 0);
    }
    
    // 방문한 게임 병합
    if (localData.visitedGames && result.visitedGames) {
        const gamesSet = new Set([...result.visitedGames, ...localData.visitedGames]);
        result.visitedGames = Array.from(gamesSet);
    }
    
    // 연속 플레이 정보 최신 것으로 유지
    if (localData.streak && localData.streakLastUpdated && result.streakLastUpdated) {
        const localDate = new Date(localData.streakLastUpdated);
        const cloudDate = new Date(result.streakLastUpdated);
        
        if (localDate > cloudDate) {
            result.streak = localData.streak;
            result.streakLastUpdated = localData.streakLastUpdated;
        }
    }
    
    return result;
}

// 외부에서 사용할 수 있도록 함수 내보내기
export {
    auth,
    db,
    currentUser,
    loginAsGuest,
    loginWithEmail,
    registerWithEmail,
    logoutUser,
    saveUserDataToCloud,
    loadUserDataFromCloud,
    syncDataWithCloud
}; 