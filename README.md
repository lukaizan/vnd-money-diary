# VND 가계부

베트남 동(VND)으로 결제한 금액을 입력하면 실시간 환율로 원화(KRW)로 환산해서
기록하는 개인용 가계부 PWA입니다.

## 폴더 구조

```
index.html              앱의 뼈대 HTML (헤더 + 화면 영역 + 하단 탭)
manifest.webmanifest    PWA 설정 (앱 이름, 아이콘, 홈 화면 추가 시 동작)
service-worker.js       오프라인에서도 앱 화면이 뜨도록 캐싱
css/style.css           전체 디자인
js/app.js               화면 전환, 환율 표시, 서비스 워커 등록을 담당하는 진입점
js/lib/storage.js       지출 데이터 저장 (지금은 localStorage, 나중에 서버로 교체 가능)
js/lib/exchangeRate.js  open.er-api.com에서 VND→KRW 환율 조회 + 1시간 캐시
js/lib/categories.js    카테고리 목록 (식비/교통/생활/기타)
js/lib/format.js        금액/날짜 표시 형식
js/screens/             입력/목록/요약 3개 화면
js/components/          하단 탭 네비게이션
icons/icon.svg          임시 아이콘 (나중에 실제 로고로 교체 예정)
```

빌드 도구(Node.js 등) 없이 그냥 파일을 브라우저에서 여는 방식이라, 코드를
수정하면 새로고침만 하면 바로 반영됩니다.

## 로컬에서 테스트하는 방법

⚠️ `index.html`을 더블클릭해서 바로 열면(`file://` 방식) 일부 기능(모듈
불러오기, 오프라인 캐싱)이 브라우저 보안 정책 때문에 제대로 동작하지 않을 수
있습니다. 아래처럼 "로컬 서버"를 통해 여는 것을 권장합니다.

- VS Code를 쓰신다면 **Live Server** 확장 프로그램을 설치 후,
  `index.html`에서 마우스 오른쪽 클릭 → "Open with Live Server"
- 또는 Node.js를 설치한 뒤 이 폴더에서 `npx serve` 실행

## 아이폰 홈 화면에 추가해서 실제로 쓰려면

로컬 컴퓨터에서만 열어보는 것은 테스트용이고, 실제로 아이폰에서 매일 쓰려면
어디서든 접속 가능한 주소(URL)가 필요합니다. 이 앱은 서버 코드가 없는 순수
정적 파일이라, 아래 같은 무료 호스팅에 폴더를 그대로 올리면 됩니다 (모두
무료, 카드 등록 불필요).

- GitHub Pages
- Netlify (폴더를 웹사이트에 드래그 앤 드롭만 해도 배포됨)
- Vercel
- Cloudflare Pages

배포 후 아이폰 Safari로 그 주소에 접속 → 공유 버튼 → "홈 화면에 추가"를
누르면 아이콘이 생기고, 앱처럼 실행됩니다. (오프라인 캐싱까지 제대로
동작하려면 `https://` 주소여야 합니다.)

## 다음 단계 (나중에 회원가입/클라우드 저장으로 확장할 때)

`js/lib/storage.js`의 `expenseRepository`만 같은 메서드(`getAll`, `add`,
`remove`)를 가진 서버 통신 버전으로 바꿔 끼우면 되고, 화면(`js/screens/`)
코드는 거의 그대로 재사용할 수 있도록 미리 분리해 두었습니다.
