<script lang="ts">
  import TomSelect from "tom-select";
  import "tom-select/dist/css/tom-select.css";
  import Swal from "sweetalert2";
  import Sidebar from "./sidebar.svelte";
  import { onMount } from "svelte";
  import { SvelteMap } from "svelte/reactivity";
  import Portal from "svelte-portal";

  import * as Types from "./types";
  import BackupRestore from "./Backup_Restore.svelte";
  import MarginGroups from "./Margin_Groups.svelte";
  import { fly } from "svelte/transition";

  const useDev = import.meta.env.MODE === "development";

  const 품목정렬방법타입 = { name_asc: "품목명 오름차순", name_desc: "품목명 내림차순", noid_desc: "등록 최신순", noid_asc: "등록 오래된순", price_asc: "가격 오름차순", price_desc: "가격 내림차순" } as const;

  const 설정초기화값 = {
    default_margin: 0,
    default_prov: 0,
    discount_qty: 0,
    discount_margin: 0,
    discount_price: 0,
    brand_disc_amount: 0,
    per_user: {},
    link_def: false,
    link_disc: false,
  };

  let 품목정렬방법: keyof typeof 품목정렬방법타입 = $state("name_asc");

  let 품목목록: Types.품목목록타입 = $state({});
  let 품목목록사본: Types.품목목록타입 = $state({});

  let 브랜드: string[] | undefined = $state([]);

  let 브랜드파라미터: string | undefined | null = $state();

  let 상세DB데이터:
    | {
        [key: string]: string;
      }
    | undefined = $state();

  let 선택된브랜드: string | undefined = $state();

  /** 선택된브랜드의 값이 변경되면, 1. 선택된 품목정렬방법으로, 2. 품목목록으로부터 선택된브랜드 값을 뽑아 3. 정렬하고 배열에 담는다. */
  let 선택된브랜드품목 = $derived.by(() => {
    if (!선택된브랜드) return [];

    const 분해 = 품목정렬방법.split("_");
    const 필드: "name" | "noid" | "price" = ["name", "noid", "price"].includes(분해[0]) ? (분해[0] as "name" | "noid" | "price") : "name";
    const 정렬방향: "asc" | "desc" = 분해[1] && ["asc", "desc"].includes(분해[1]) ? (분해[1] as "asc" | "desc") : "asc";

    const 정렬방법 = {
      name: (x: Types.개별품목타입, i: number) => ({ index: i, value: x.product.toLowerCase() }),
      noid: (x: Types.개별품목타입, i: number) => ({ index: i, value: parseInt(String(x.no_id)) }),
      price: (x: Types.개별품목타입, i: number) => ({ index: i, value: parseInt(String(x.price)) }),
    };

    let mapped = 선택된브랜드 ? 품목목록 && 품목목록[선택된브랜드].map((x, i) => 정렬방법[필드](x, i)) : undefined;

    if (mapped) {
      if (정렬방향 === "asc") {
        mapped.sort((a, b) => {
          return +(a.value > b.value) || +(a.value === b.value) - 1;
        });
      } else {
        mapped.sort((a, b) => {
          return +(a.value < b.value) || +(a.value === b.value) - 1;
        });
      }

      const result = mapped.map(el => {
        return 품목목록[선택된브랜드 as string][el.index];
      });
      return result;
    }

    return [];
  });

  let 아이디별마진열림 = $derived.by(() => {
    const obj: { [key: string]: boolean } = {};

    선택된브랜드품목?.forEach(element => {
      obj[element.PROD_CD] = false;
    });

    return obj;
  });

  let 변경된행 = new SvelteMap<Types.개별품목타입["no_id"], Types.개별품목타입>();
  let 편집된그룹 = new SvelteMap<Types.브랜드별마진그룹타입["uuid"], Types.브랜드별마진그룹타입>();
  if (useDev) $inspect(변경된행);

  let 마진공급가자동계산 = $derived(선택된브랜드품목?.every(품목 => 품목.default_margin && typeof 품목.default_margin == "object" && 품목.default_margin.link_def && 품목.default_margin.link_disc));

  let 아이디목록: Types.아이디목록타입[] = $state([]);

  /** 마진 설정값 가져오기를 위한 변수로, 아이디-닉네임 쌍으로 된 객체로 변환 생성해준다. */
  let 아이디목록캐싱 = $derived.by(() => {
    const obj: { [key: string]: string } = {};
    아이디목록?.forEach(element => {
      obj[element.mb_id] = element.mb_nick;
    });
    return obj;
  });

  let 아이디입력상자: HTMLSelectElement | undefined = $state();

  /** 아이디입력상자가 DOM에 있고, 아이디목록이 로드 완료되면 TomSelect로 셀렉터를 변환시켜준다. */
  let 아이디선택상자 = $derived.by(() => {
    if (!(아이디입력상자 && 아이디목록 && 아이디목록.length > 0)) return;
    return new TomSelect(아이디입력상자, {
      valueField: "mb_id",
      labelField: "mb_nick",
      searchField: ["mb_id", "mb_nick"],
      plugins: {
        remove_button: {
          title: "항목 삭제",
        },
      },
      refreshThrottle: 0,
      placeholder: "아이디 선택... (복수 선택 가능)",
      onChange: (value: string[]) => {
        선택된아이디 = value;
        if (document.querySelector(".ts-control input")) (document.querySelector(".ts-control input") as HTMLInputElement).value = "";
      },
      maxOptions: undefined,
    });
  });

  let 선택된아이디: string[] = $state([]);

  /** 테이블 너비를 한번에 관리하고 테이블 헤드 라벨을 여기서 수정할 수 있다. 컬럼 표시 여부도 설정할 수 있다. */
  let 품목테이블컬럼속성: Types.품목테이블컬럼속성타입 = $derived({
    no_id: { width: "0%", display: false, label: "" },
    품목명: { width: "30%", display: true, label: "품목명" },
    소비자가: { width: "10%", display: true, label: "소비자가(원)" },
    기본마진: { width: "10%", display: true, label: (선택된아이디.length > 0 ? "업체별 " : "") + "기본 마진(%)" },
    기본공급가: { width: "10%", display: true, label: (선택된아이디.length > 0 ? "업체별 " : "") + "기본 공급가(원)" },
    할인마진: {
      width: "10%",
      display: true,
      label: (선택된아이디.length == 0 ? "기본 " : "업체별 ") + "할인 마진(%)",
    },
    할인공급가: {
      width: "10%",
      display: true,
      label: (선택된아이디.length == 0 ? "기본 " : "업체별 ") + "할인 공급가(원)",
    },
    할인수량: { width: "10%", display: true, label: "할인 수량(개)" },
    브랜드할인최소액: {
      width: "10%",
      display: true,
      label: "브랜드 할인 최소액(원)",
    },
  });

  let 브랜드일괄편집필드: Omit<Types.마진타입, "per_user"> = $state({
    default_margin: undefined,
    default_prov: undefined,
    discount_qty: undefined,
    discount_margin: undefined,
    discount_price: undefined,
    brand_disc_amount: undefined,
    link_def: false,
    link_disc: false,
  });

  let 내용변경여부 = $state(false);

  let 적용중여부 = $state(false);

  let 적용반환값:
    | {
        method: string;
        status: string;
        error: string | null;
        data: string[];
      }
    | undefined
    | null = $state();

  let 품목테이블바디: HTMLElement | undefined = $state();

  let 테이블컨테이너: HTMLElement | undefined = $state();

  let 마진설정값가져오기팝업열림 = $state(false);
  let 마진설정값가져올아이디: string | undefined = $state();

  let 마진초기화팝업작게표시 = $state(false);

  let 앱요소: HTMLElement | undefined = $state();
  let 마진설정보기활성화 = $state(false);
  let 마진설정보기팝업: HTMLElement | undefined = $state();
  let 마진그룹: Types.마진그룹타입 = $derived({});
  let 마진그룹초기화 = $state(false);
  let 현재마진탭: string | null = $state(null);

  function 브랜드일괄편집필드리셋() {
    브랜드일괄편집필드 = {
      default_margin: undefined,
      default_prov: undefined,
      discount_qty: undefined,
      discount_margin: undefined,
      discount_price: undefined,
      brand_disc_amount: undefined,
      link_def: false,
      link_disc: false,
    };
  }

  async function 품목목록가져오기() {
    브랜드 = [];
    try {
      const 가져오기 = await fetch("https://b2b.soundcat.com/page/get_products.php", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Use-Dev": String(useDev),
        },
        body: JSON.stringify({
          key: "b2b_margin_setup",
        }),
      });

      if (가져오기.ok) {
        const 결과: Types.품목목록타입 = await 가져오기.json();
        브랜드 = 결과 && Object.keys(결과);
        브랜드.forEach(아이템 => {
          품목목록[아이템] = 결과[아이템].map((아이템: Types.개별품목타입) => {
            let default_margin;
            try {
              if (typeof 아이템.default_margin == "string") {
                default_margin = JSON.parse(아이템.default_margin);
                if (typeof default_margin != "object") throw new Error("마진 란이 객채가 아닙니다.");
                if (Object.keys(default_margin).length == 0) throw new Error("마진 란이 비어있습니다.");
              } else {
                throw new Error("마진 란이 비어있습니다.");
              }
            } catch (e) {
              default_margin = structuredClone(설정초기화값);
            }
            return {
              ...아이템,
              default_margin,
            };
          });
        });
        품목목록사본 = structuredClone($state.snapshot(품목목록));
        if (브랜드파라미터 && 품목목록[브랜드파라미터]) {
          선택된브랜드 = 브랜드파라미터;
        } else if (브랜드파라미터) {
          const url = new URL(location.href);
          url.searchParams.delete("brand");
          history.replaceState(null, "", url.href);
        }
      } else {
        throw new Error("서버 접속 실패." + JSON.stringify(가져오기));
      }
    } catch (e) {
      console.error(e);
      브랜드 = undefined;
    }
  }

  async function 아이디가져오기() {
    아이디목록 = [];
    try {
      const 가져오기 = await fetch("https://b2b.soundcat.com/page/get_members.php", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Use-Dev": String(useDev),
        },
        body: JSON.stringify({
          onlypartners: true,
        }),
      });

      if (가져오기.ok) {
        const 결과 = await 가져오기.json();
        아이디목록 = 결과.data;
      } else {
        throw new Error("서버 접속 실패." + JSON.stringify(가져오기));
      }
    } catch (e) {
      console.error(e);
      아이디목록 = [];
    }
  }

  /**
   * 유저 별 특별 공급마진 객체를 확인하고 없으면 생성해준다.
   * @param 품목 개별 품목 행
   * @param 아이디 아이디 값
   */
  function 유저별엔트리생성(품목: Types.개별품목타입, 아이디: string) {
    if (typeof 품목.default_margin.per_user != "object") 품목.default_margin.per_user = {};

    if (!품목.default_margin.per_user?.[아이디])
      품목.default_margin.per_user[아이디] = {
        default_margin: 품목.default_margin.default_margin,
        default_prov: 품목.default_margin.default_prov,
        discount_margin: 품목.default_margin.discount_margin,
        discount_price: 품목.default_margin.discount_price,
        discount_qty: 품목.default_margin.discount_qty,
      };
  }

  /**
   * 품목 배열로부터 현재 입력중인 필드에 값을 가져오고 포맷팅해서 보여준다.
   * @param 품목 개별 품목 행 (단일 혹은 전체)
   * @param 유형 현재 입력중인 필드명
   */
  function 마진값겟터({ 품목, 유형, 각아이디 }: { 품목: Types.개별품목타입 | Types.개별품목타입[]; 유형: keyof Omit<Types.마진설정값타입, "brand_disc_amount">; 각아이디?: string }) {
    const 가져올품목 = Array.isArray(품목) ? 품목 : [품목];
    let 반환할값;

    for (품목 of 가져올품목) {
      if (각아이디) {
        return 로케일숫자로표시(품목.default_margin.per_user?.[각아이디]?.[유형] ?? 품목.default_margin[유형]);
      } else if (선택된아이디.length == 0) {
        반환할값 = 로케일숫자로표시(품목.default_margin[유형]);
      } else {
        const 첫번째아이디값 = 품목.default_margin.per_user?.[선택된아이디[0]]?.[유형] ?? 품목.default_margin[유형];
        for (const 각아이디 of 선택된아이디) {
          if (첫번째아이디값 != 품목.default_margin.per_user?.[각아이디]?.[유형]) return 로케일숫자로표시(품목.default_margin[유형]);
        }
        반환할값 = 로케일숫자로표시(첫번째아이디값);
      }
    }

    return 반환할값;
  }

  /**
   * 필드에 입력된 값을 적절한 형태(숫자, 문자열)로 안전하게 가공하고 품목 배열에 집어넣는다.
   * @param 값 입력된 값
   * @param 품목 개별 품목 행 (단일 혹은 전체)
   * @param 유형 현재 입력중인 필드명
   * @param 리셋 선택된 필드(유형) 리셋 여부
   */
  function 마진값셋터({ 값, 품목, 유형, 각아이디, 리셋 = false }: { 값: string | number | undefined; 품목: Types.개별품목타입 | Types.개별품목타입[]; 유형: keyof Types.마진설정값타입; 각아이디?: string; 리셋?: boolean }) {
    const 세팅할품목 = Array.isArray(품목) ? 품목 : [품목];
    let 링크값: keyof Types.마진설정값타입 | undefined = undefined;
    let 링크타겟: "link_def" | "link_disc" = "link_def";
    let 링크값가격계산여부: boolean = false;

    /**
     * 현재 입력중인 필드에 대응하는 값을 자동으로 입력해주는 함수. 마진이면 공급가, 공급가면 마진.
     * @param 링크값가격계산여부
     * @param 소비자가
     * @param 마진
     * @param 할인가
     */
    const 링크값계산 = (링크값가격계산여부: boolean, 소비자가: number, 마진: string | number | undefined, 할인가: string | number | undefined) => {
      if (링크값가격계산여부) {
        return parseFloat(String(소비자가)) * ((100 - parseFloat(String(숫자로변환(값 ?? 마진)))) / 100);
      } else {
        return 100 - (parseFloat(String(할인가)) / parseFloat(String(소비자가))) * 100;
      }
    };

    switch (유형) {
      case "default_margin":
        링크값 = "default_prov";
        링크값가격계산여부 = true;
        링크타겟 = "link_def";
        break;
      case "default_prov":
        링크값 = "default_margin";
        링크타겟 = "link_def";
        break;
      case "discount_margin":
        링크값 = "discount_price";
        링크타겟 = "link_disc";
        링크값가격계산여부 = true;
        break;
      case "discount_price":
        링크타겟 = "link_disc";
        링크값 = "discount_margin";
        break;
      case "discount_qty":
        링크값가격계산여부 = false;
        break;
    }

    for (const 품목 of 세팅할품목) {
      if (리셋) {
        if (유형 == "brand_disc_amount") {
          품목.default_margin.brand_disc_amount = undefined;
          continue;
        }
        if (선택된아이디.length > 0) {
          for (const 각아이디 of 선택된아이디) {
            if (품목.default_margin.per_user[각아이디]?.[유형]) delete 품목.default_margin.per_user[각아이디][유형];
            if (품목.default_margin.per_user[각아이디]?.default_margin == 0 || 품목.default_margin.per_user[각아이디]?.default_margin == "0") {
              delete 품목.default_margin.per_user[각아이디].default_margin;
              delete 품목.default_margin.per_user[각아이디].default_prov;
            }
            if (품목.default_margin.per_user[각아이디]?.discount_margin == 0 || 품목.default_margin.per_user[각아이디]?.discount_margin == "0") {
              delete 품목.default_margin.per_user[각아이디].discount_margin;
              delete 품목.default_margin.per_user[각아이디].discount_price;
            }
            if ((품목.default_margin.per_user[각아이디] && Object.keys(품목.default_margin.per_user[각아이디]).length === 0) || Object.values({ ...품목.default_margin.per_user[각아이디], discount_price: 0, default_prov: 0 }).every(value => !value || value == "0")) delete 품목.default_margin.per_user[각아이디];
          }
        }
        if (각아이디) {
          품목.default_margin.per_user[각아이디][유형] = undefined;
          if (품목.default_margin[링크타겟] && 링크값) 품목.default_margin.per_user[각아이디][링크값] = undefined;
        } else {
          품목.default_margin[유형] = undefined;
          if (품목.default_margin[링크타겟] && 링크값) 품목.default_margin[링크값] = undefined;
        }
        continue;
      }

      let 마진설정할품목들: Omit<Types.마진설정값타입, "brand_disc_amount">[] = [];

      if (각아이디) {
        마진설정할품목들.push(품목.default_margin.per_user[각아이디]);
      } else if (선택된아이디.length == 0) {
        마진설정할품목들.push(품목.default_margin);
      } else {
        for (const 각아이디 of 선택된아이디) {
          유저별엔트리생성(품목, 각아이디);
          마진설정할품목들.push(품목.default_margin.per_user[각아이디]);
        }
      }

      for (const 마진설정할품목 of 마진설정할품목들) {
        if (유형 == "brand_disc_amount") continue;
        마진설정할품목[유형] = 숫자로변환(값 ?? 품목.default_margin[유형]);
        if (품목.default_margin[링크타겟] && 링크값) 마진설정할품목[링크값] = 링크값계산(링크값가격계산여부, 품목.price, 마진설정할품목[유형], 마진설정할품목[유형]);
      }

      if (각아이디 || 선택된아이디.length > 0) 품목.default_margin.per_user = { ...품목.default_margin.per_user };
    }

    if (리셋) 행업데이트(품목, 유형);
  }

  /**
   * 어떤 값이든 숫자로 반환해준다. 숫자로 반환할 수 없는 값이 들어오면 NaN이 반환된다.
   * @param 값
   */
  function 숫자로변환(값: string | number | undefined) {
    if (!값) return 0;
    const 반환할값 =
      String(값)
        .replace(/[^0-9.]/g, "")
        .replace(/\.\.+/g, ".") || "0";
    const 파싱한값 = parseFloat(반환할값);
    return (반환할값.match(/\./g) || []).length == 1 && 반환할값.endsWith(".") ? 반환할값 : 파싱한값;
  }

  /**
   * 숫자에 천단위 구분점(,)을 찍어 반환한다.
   * @param 값 숫자값
   */
  function 로케일숫자로표시(값: string | number | undefined) {
    if (!값) return 0;
    return String(값).endsWith(".") ? 값 : Intl.NumberFormat("ko-KR").format(parseFloat(String(값)));
  }

  /**
   * 브랜드 값을 일괄 편집하는 필드에서 값을 입력하고 변경하면 해당 브랜드의 품목의 각 필드 값을 입력한 값으로 넣어준다.
   * @param 값
   * @param 타겟 어떤 필드에 들어가야 하는지 정의한다. boolean 타입과 object 타입에는 들어갈 수 없도록 타입 적용.
   */
  function 브랜드값일괄편집<Target extends Exclude<keyof Types.마진타입, "per_user"> & Exclude<keyof Types.마진타입, "link_def"> & Exclude<keyof Types.마진타입, "link_disc">>(값: string | number, 타겟: Target) {
    선택된브랜드품목?.forEach(품목 => {
      (품목.default_margin as Types.마진타입)[타겟] = 숫자로변환(값);
      변경된행.set(품목.no_id, 품목);
    });
  }

  /**
   * 값을 변경하면 업데이트가 되어야 하는 행으로 대기 배열(변경된행)에 집어넣어 준다.
   * @param 품목 개별 품목
   * @param 유형 편집된 필드
   */
  async function 행업데이트(품목: Types.개별품목타입 | Types.개별품목타입[], 유형: keyof Types.마진설정값타입 | undefined = undefined) {
    const 세팅할품목 = Array.isArray(품목) ? 품목 : [품목];

    let 유저값초기화여부 = undefined;

    for (품목 of 세팅할품목) {
      if (선택된아이디.length == 0 && 유저값초기화여부 == undefined && 유형 && 품목.default_margin && typeof 품목.default_margin == "object" && Object.keys(품목.default_margin.per_user).length) {
        const 팝업창 = await Swal.fire({
          icon: "question",
          title: `입력한 품목에 대한 아이디 별 마진 설정 값을 초기화하시겠습니까?`,
          html: `<details><summary>초기화 대상 품목 보기:</summary><div><code><pre>${세팅할품목.map(x => x.product).join("\n")}</pre></code></div></details><p>참고: 모든 대상 품목이 아이디 별 마진 설정 값이 있는 것은 아닙니다.</p>`,
          confirmButtonText: "예",
          showCancelButton: true,
          cancelButtonText: "아니오",
          showDenyButton: !마진초기화팝업작게표시,
          denyButtonText: "5분간 작게 알림",
          toast: 마진초기화팝업작게표시,
          timer: 마진초기화팝업작게표시 ? 10000 : 0,
          timerProgressBar: 마진초기화팝업작게표시,
          position: 마진초기화팝업작게표시 ? "bottom" : "center",
          width: "fit-content",
          focusCancel: true,
        });

        if (팝업창.isDenied) 마진초기화팝업작게표시 = true;

        if (!유저값초기화여부) 유저값초기화여부 = 팝업창.isConfirmed;
      }
      if (유저값초기화여부 && 품목.default_margin && typeof 품목.default_margin == "object") 품목.default_margin.per_user = {};
      품목.edited = true;
      변경된행.set(품목.no_id, 품목);
    }
  }

  /**
   * 각 아이디 별로 특별 마진 값이 들어있는지 여부를 출력한다.
   * @param 품목
   * @param 유형
   */
  function 수정여부확인(품목: Types.개별품목타입, 유형: keyof Omit<Types.마진설정값타입, "brand_disc_amount">) {
    let 반환할값 = false;
    for (const 각아이디 of 선택된아이디) {
      if (반환할값 == false && 품목?.default_margin && typeof 품목?.default_margin == "object" && 품목.default_margin.per_user?.[각아이디]?.[유형] && 품목.default_margin[유형] != 품목.default_margin.per_user?.[각아이디]?.[유형]) 반환할값 = true;
    }

    return 반환할값;
  }

  /** 서버에 변경된행 값을 전달한다. */
  async function 적용() {
    적용중여부 = true;
    try {
      if (변경된행.size > 0) {
        const 팝업 = Swal;
        const 팝업창 = 팝업.fire({
          title: "품목 마진 설정 값 적용 중...",
          showConfirmButton: false,
          allowEscapeKey: false,
          allowOutsideClick: false,
        });
        const 요청 = await fetch("https://b2b.soundcat.com/page/margin_setup_update.php", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Use-Dev": String(useDev),
          },
          body: JSON.stringify([...변경된행.values()]),
        });

        if (요청.ok) {
          const 결과: typeof 적용반환값 = await 요청.json();
          팝업.clickConfirm();
          Swal.fire({
            icon: "success",
            title: "작업이 성공적으로 이루어졌습니다.",
            html: "&nbsp;",
            confirmButtonText: "닫기",
            customClass: {
              htmlContainer: "successful-popup",
            },
            willOpen: () => {
              적용반환값 = 결과;
              적용중여부 = false;
            },
          });

          적용반환값 = undefined;
          [...변경된행.values()].forEach(x => delete x.edited);
          변경된행.clear();
          품목목록사본 = structuredClone($state.snapshot(품목목록));
        } else {
          throw new Error("서버에 접속하지 못했습니다: " + JSON.stringify(요청));
        }
      }
      if (편집된그룹.size > 0) {
        const 팝업 = Swal;
        const 팝업창 = 팝업.fire({
          title: "마진 그룹 변경 사항 적용 중...",
          showConfirmButton: false,
          allowEscapeKey: false,
          allowOutsideClick: false,
        });
        const 요청 = await fetch("https://b2b.soundcat.com/page/product_margin_group_update.php?action=data", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Use-Dev": String(useDev),
          },
          body: JSON.stringify([...변경된행.values()]),
        });

        if (요청.ok) {
          const 결과: typeof 적용반환값 = await 요청.json();
          팝업.clickConfirm();
          Swal.fire({
            icon: "success",
            title: "작업이 성공적으로 이루어졌습니다.",
            html: "&nbsp;",
            confirmButtonText: "닫기",
            customClass: {
              htmlContainer: "successful-popup",
            },
            willOpen: () => {
              적용반환값 = 결과;
              적용중여부 = false;
            },
          });

          적용반환값 = undefined;
          [...변경된행.values()].forEach(x => delete x.edited);
          변경된행.clear();
          품목목록사본 = structuredClone($state.snapshot(품목목록));
        } else {
          throw new Error("서버에 접속하지 못했습니다: " + JSON.stringify(요청));
        }
      }
    } catch (e) {
      console.error(e);
      Swal.fire({
        icon: "error",
        title: "적용 실패했습니다.",
        text: JSON.stringify(e) + "\n" + "다시 시도해보세요.",
        confirmButtonText: "닫기",
      });
    } finally {
      적용중여부 = false;
    }
  }

  /** 테이블에서 상하 화살표키를 누르면 필드가 선택되게끔 해주는 함수 */
  const 테이블셀상하이동 = async (e: KeyboardEvent) => {
    if (품목테이블바디 && (e.target as HTMLElement)?.nodeName == "INPUT") {
      const targetCell = (e.target as HTMLElement)?.closest("td");
      const targetRow = (e.target as HTMLElement)?.closest("tr");
      const targetBody = (e.target as HTMLElement)?.closest("tbody");
      const rows = targetBody?.querySelectorAll("tr");
      const cells = targetRow?.querySelectorAll("td");
      const rowIndex = targetRow ? Array.from(rows ?? []).indexOf(targetRow) : -1;
      const cellIndex = targetCell ? Array.from(cells ?? []).indexOf(targetCell) : -1;

      let 타겟;
      if (e.key == "ArrowDown" && rows && rowIndex < (rows.length ?? -1) - 1) {
        타겟 = rows[rowIndex + 1].querySelectorAll("td")?.[cellIndex]?.querySelector("input");
      } else if (e.key == "ArrowUp" && rows && rowIndex > 0) {
        타겟 = rows[rowIndex - 1].querySelectorAll("td")?.[cellIndex]?.querySelector("input");
      }
      if (타겟) {
        타겟?.focus();
        setTimeout(() => 타겟?.select(), 0);
      }
    }
  };

  /** 입력 필드에서 마우스 클릭 후 떼면 클릭한 입력 요소의 값이 전체 선택되도록 */
  function 포인터업(e: PointerEvent) {
    if ((e.target as HTMLElement).nodeName == "INPUT") {
      (e.target as HTMLInputElement)?.select();
    }

    if (마진설정보기활성화 && e.target instanceof HTMLElement && 마진설정보기팝업 && !마진설정보기팝업.contains(e.target)) 마진설정보기활성화 = false;
  }

  /** 테이블에서 스크롤 시 모서리에 그라데이션을 적용한다. */
  function 테이블스크롤(e: UIEvent) {
    if (!테이블컨테이너) return;

    const tableFullWidth = 테이블컨테이너.scrollWidth;
    const tableClientWidth = 테이블컨테이너.clientWidth;
    const tableFullHeight = 테이블컨테이너.scrollHeight;
    const tableClientHeight = 테이블컨테이너.clientHeight;
    const xScrollPos = 테이블컨테이너.scrollLeft;
    const yScrollPos = 테이블컨테이너.scrollTop;

    if (tableFullWidth != tableClientWidth) {
      if (xScrollPos == 0) {
        테이블컨테이너.setAttribute("data-x", "right");
      } else if (xScrollPos + tableClientWidth == tableFullWidth) {
        테이블컨테이너.setAttribute("data-x", "left");
      } else {
        테이블컨테이너.setAttribute("data-x", "both");
      }
    }

    if (tableFullHeight != tableClientHeight) {
      if (yScrollPos == 0) {
        테이블컨테이너.setAttribute("data-y", "bottom");
      } else if (yScrollPos + tableClientHeight == tableFullHeight) {
        테이블컨테이너.setAttribute("data-y", "top");
      } else {
        테이블컨테이너.setAttribute("data-y", "both");
      }
    }
  }

  /** 마진 설정 값 가져오기 버튼을 누르면 어떤 아이디로부터 마진 설정 값을 가져올지 선택하는 팝업을 띄운다. */
  async function 마진설정값가져오기팝업(e: UIEvent) {
    if (선택된아이디.length === 0) return;

    마진설정값가져올아이디 = undefined;

    const 팝업결정 = await Swal.fire({
      html: "&nbsp;",
      showCancelButton: true,
      cancelButtonText: "취소(닫기)",
      confirmButtonText: "가져오기",
      customClass: {
        htmlContainer: "margin_import_popup",
      },
      willOpen: () => {
        마진설정값가져오기팝업열림 = true;
      },
      didClose: () => {
        마진설정값가져오기팝업열림 = false;
      },
    });

    if (팝업결정.isConfirmed && 마진설정값가져올아이디 && 선택된브랜드품목) {
      for (const 품목 of 선택된브랜드품목) {
        if (품목.default_margin.per_user?.[마진설정값가져올아이디]) {
          let 넣을값 = 품목.default_margin.per_user?.[마진설정값가져올아이디];
          for (const 각아이디 of 선택된아이디) {
            품목.default_margin.per_user[각아이디] = structuredClone($state.snapshot(넣을값));
          }
        }
        품목.default_margin.per_user = {
          ...$state.snapshot(품목.default_margin.per_user),
        };
        변경된행.set(품목.no_id, 품목);
      }
    }

    마진설정값가져올아이디 = undefined;
  }

  onMount(async () => {
    const url = new URL(location.href);
    브랜드파라미터 = url.searchParams.get("brand");
    품목목록가져오기();
    await 아이디가져오기();
  });

  /** 아이디목록이 업데이트되면 아이디선택상자 TomSelect에 옵션을 추가한다. */
  $effect(() => {
    if (아이디선택상자 && 아이디목록 && 아이디목록.length > 0) {
      아이디선택상자.addOptions(아이디목록);
    }
  });

  /** 선택된 브랜드가 변경되면 브랜드 일괄 편집의 각 필드를 리셋한다. */
  $effect(() => {
    if (선택된브랜드) 브랜드일괄편집필드리셋();
  });

  /** 선택된 아이디가 변경되어도 리셋한다. */
  $effect(() => {
    if (선택된아이디) 브랜드일괄편집필드리셋();
  });

  /** 변경된행 배열의 개수가 1개 이상이면 내용변경여부를 true로 아니면 false로 반환한다. */
  $effect(() => {
    내용변경여부 = 변경된행.size > 0 || 편집된그룹.size > 0 ? true : false;
  });

  /** 상세DB데이터의 내용이 변경 또는 추가되면 품목목록에서 각 품목의 href 키에 상세DB 게시글 주소를 저장한다.*/
  $effect(() => {
    if (품목목록 && 상세DB데이터) {
      for (const 브랜드항목 of Object.entries(품목목록)) {
        for (const 품목 of 브랜드항목[1]) 품목.href = 상세DB데이터[품목.PROD_CD];
      }
    }
  });

  /** 선택된브랜드가 없으면 GET 파라미터로부터 선택될 브랜드를 가져온다. (초기화 용) */
  $effect(() => {
    if (!선택된브랜드) return;
    const url = new URL(location.href);
    url.searchParams.set("brand", 선택된브랜드);
    history.replaceState(null, "", url.href);
  });

  /** 마진을 초기화하겠냐는 팝업은 소비자가를 수정할 때 아이디 별 입력 값이 있으면 항상 표시되는데, 작게 표시를 누르면 작게 표시한다. (1분간) */
  $effect(() => {
    if (마진초기화팝업작게표시) setTimeout(() => (마진초기화팝업작게표시 = false), 300000);
  });
</script>

{#snippet brandAll(target: keyof Types.마진설정값타입, callback: (target: keyof Types.마진설정값타입, e: Event) => void)}
  <div>
    <input
      type="text"
      onchange={e => {
        callback(target, e);
      }}
      bind:value={
        () => 로케일숫자로표시(브랜드일괄편집필드[target]),
        (v: string | number) => {
          브랜드일괄편집필드[target] = 숫자로변환(v);
        }
      } />
  </div>
{/snippet}
{#snippet eachProduct(품목: Types.개별품목타입, target: keyof Omit<Types.마진설정값타입, "brand_disc_amount">, 각아이디?: string)}
  <div>
    <input
      type="text"
      onchange={() => 행업데이트(품목, target)}
      bind:value={
        () => 마진값겟터({ 품목, 유형: target, 각아이디 }),
        (v: string | number | undefined) => {
          마진값셋터({ 값: v, 품목, 유형: target, 각아이디 });
        }
      } />
  </div>
{/snippet}
{#snippet resetBtn(품목: Types.개별품목타입, target: keyof Types.마진설정값타입)}
  <button class="reset-field" tabindex="-1" aria-label="필드 값 리셋" onclick={() => 마진값셋터({ 값: undefined, 품목, 유형: target, 리셋: true })}>
    <i class="fas fa-trash"></i>
  </button>
{/snippet}

<svelte:window onkeydown={테이블셀상하이동} onpointerup={포인터업} on:dragover={e => e.preventDefault()} on:drop={e => e.preventDefault()} />
<div class={["app-section", 적용중여부 && "submitting", 마진설정보기활성화 && "margin_popup"]} bind:this={앱요소}>
  <Sidebar {브랜드} bind:선택된브랜드 {품목목록가져오기} />
  <div class="app-toolbar">
    <div class="app-user-select-container">
      <select multiple class="app-user-select" bind:this={아이디입력상자}> </select>
    </div>
    <button type="button" class={["blue", 선택된아이디.length || "disabled"]} onclick={마진설정값가져오기팝업}>마진 설정값 가져오기</button>
    <div></div>
    <div></div>
    <BackupRestore bind:품목목록 />
    <div>
      <select name="item_order" id="item_order" bind:value={품목정렬방법} placeholder="정렬방법">
        {#each Object.entries(품목정렬방법타입) as 정렬방법}
          <option value={정렬방법[0]}>{정렬방법[1]}</option>
        {/each}
      </select>
    </div>
    <div class="app-submit-div">
      <label class="app-checkbox-label">
        <i></i>
        <input
          type="checkbox"
          bind:checked={마진공급가자동계산}
          onclick={() => {
            const 현재체크 = 마진공급가자동계산;
            선택된브랜드품목?.forEach(품목 => {
              if (품목.default_margin && typeof 품목.default_margin == "object") {
                if (!현재체크) {
                  품목.default_margin.link_def = true;
                  품목.default_margin.link_disc = true;
                } else {
                  품목.default_margin.link_def = !품목.default_margin.link_def;
                  품목.default_margin.link_disc = !품목.default_margin.link_disc;
                }
              }
              변경된행.set(품목.no_id, 품목);
            });
          }} />선택된 브랜드 마진↔︎공급가 자동계산</label>
      <button
        type="button"
        class={["cancel", 내용변경여부 || "disabled"]}
        onclick={() => {
          변경된행.clear();
          편집된그룹.clear();
          품목목록 = structuredClone($state.snapshot(품목목록사본));
          마진그룹초기화 = true;
          브랜드일괄편집필드리셋();
        }}><i class="fas fa-undo"></i> 변경 취소</button>
      <button type="button" class={["submit", 내용변경여부 || "disabled"]} onclick={적용}>
        <i class="fas fa-check"></i> 저장
      </button>
    </div>
  </div>
  {#if 브랜드 && 브랜드.length == 0}
    <div class="loading">브랜드를 가져오는 중입니다...</div>
  {:else if !브랜드}
    <div class="failed">
      <div>브랜드 목록 가져오기를 실패했습니다. 재시도하시겠습니까?</div>
      <div>
        <button class="retry-btn" onclick={() => 품목목록가져오기()}><i class="fas fa-redo"></i> 재시도</button>
      </div>
    </div>
  {/if}
  {#if 아이디목록 && 아이디목록.length == 0}
    <div class="loading">아이디 목록을 가져오는 중입니다...</div>
  {:else if !아이디목록}
    <div class="failed">
      <div>아이디 목록 가져오기를 실패했습니다. 재시도하시겠습니까?</div>
      <div>
        <button class="retry-btn" onclick={() => 아이디가져오기()}><i class="fas fa-redo"></i> 재시도</button>
      </div>
    </div>
  {/if}
  <MarginGroups {선택된브랜드} bind:마진그룹 bind:마진그룹초기화 bind:마진설정보기활성화 bind:마진설정보기팝업 bind:현재마진탭 {앱요소} {아이디목록} bind:선택된브랜드품목 {편집된그룹} />
  {#if 선택된브랜드 && 선택된브랜드품목}
    <div class={["app-table-container"]} data-x="no" data-y="bottom" bind:this={테이블컨테이너} onwheel={테이블스크롤}>
      <table class="app-table">
        <colgroup>
          {#each Object.keys(품목테이블컬럼속성) as 컬럼명}
            {#if 품목테이블컬럼속성[컬럼명 as keyof typeof 품목테이블컬럼속성].display}
              <col width={품목테이블컬럼속성[컬럼명 as keyof typeof 품목테이블컬럼속성].width} />
            {/if}
          {/each}
        </colgroup>
        <thead>
          <tr>
            {#each Object.keys(품목테이블컬럼속성) as 컬럼명}
              {#if 품목테이블컬럼속성[컬럼명 as keyof typeof 품목테이블컬럼속성].display}
                <th>
                  <div>
                    <span>
                      {품목테이블컬럼속성[컬럼명 as keyof typeof 품목테이블컬럼속성].label}
                    </span>
                  </div></th>
              {/if}
            {/each}
          </tr>
        </thead>
        <tbody>
          <tr style="background:#f2f2f2">
            <td>
              <div>
                <span><b>{선택된브랜드} 브랜드 전체 수정</b> (값 입력 후 엔터)</span>
              </div></td>
            <td></td>
            <td>
              {@render brandAll("default_margin", (target, e) => {
                if (!(e.currentTarget instanceof HTMLInputElement)) return;
                마진값셋터({ 값: e.currentTarget.value, 품목: 선택된브랜드품목, 유형: target });
                행업데이트(선택된브랜드품목, target);
              })}</td>
            <td></td>
            <td>
              {@render brandAll("discount_margin", (target, e) => {
                if (!(e.currentTarget instanceof HTMLInputElement)) return;
                마진값셋터({ 값: e.currentTarget.value, 품목: 선택된브랜드품목, 유형: target });
                행업데이트(선택된브랜드품목, target);
              })}
            </td>
            <td></td>
            <td>
              {@render brandAll("discount_qty", (target, e) => {
                if (!(e.currentTarget instanceof HTMLInputElement)) return;
                브랜드값일괄편집(e.currentTarget.value, target);
              })}
            </td>
            <td>
              {@render brandAll("brand_disc_amount", (target, e) => {
                if (!(e.currentTarget instanceof HTMLInputElement)) return;
                브랜드값일괄편집(e.currentTarget.value, target);
              })}
            </td>
          </tr>
        </tbody>
        {#if 선택된브랜드품목.length}
          <tbody bind:this={품목테이블바디}>
            {#each 선택된브랜드품목 as 품목}
              <tr class:hidden={parseInt(String(품목.hidden))} class:edited={품목.edited}>
                <td class="product_cell">
                  <div>
                    <span style={아이디별마진열림[품목.PROD_CD] ? `font-weight: bold` : ""}>
                      {품목.product}
                      {#if 품목.href}
                        <a class="download_db" target="_blank" href={품목.href}>(상세DB 보기)</a>
                      {/if}
                    </span>
                    {#if Object.keys(품목.default_margin.per_user).length > 0}
                      <button
                        onclick={() => {
                          const obj = structuredClone($state.snapshot(아이디별마진열림));
                          obj[품목.PROD_CD] = !obj[품목.PROD_CD];
                          아이디별마진열림 = obj;
                        }}
                        title="아이디 별 마진값 자세히 보기"
                        aria-label="아이디 별 마진값 자세히 보기"
                        class="hasperuser"
                        data-peruser="해당 품목은 업체 별 마진값이 설정되어 있습니다.&#13;설정된 업체: {Object.keys(품목.default_margin.per_user)
                          .map(x => 아이디목록캐싱[x])
                          .join(', ')}"><i class="fas fa-exclamation-circle"></i></button>
                    {/if}
                  </div>
                </td>
                <td>
                  <div style="text-align: center;">
                    <span>{Intl.NumberFormat("ko-KR").format(품목.price)}</span>
                  </div></td>
                {#if typeof 품목.default_margin == "object"}
                  <td class:peruser={수정여부확인(품목, "default_margin")}>
                    {@render eachProduct(품목, "default_margin")}
                    {@render resetBtn(품목, "default_margin")}
                    <button
                      class="link"
                      tabindex="-1"
                      onclick={() => {
                        if (품목.default_margin && typeof 품목.default_margin == "object") 품목.default_margin.link_def = !품목.default_margin.link_def;
                        변경된행.set(품목.no_id, 품목);
                      }}
                      aria-label="기본마진-공급가 자동계산"
                      ><i class={["fas", 품목.default_margin?.link_def ? "fa-link" : "fa-unlink"]}></i>
                      <b>기본마진↔︎공급가 자동계산</b>
                    </button>
                  </td>
                  <td class:peruser={수정여부확인(품목, "default_prov")}>
                    {@render eachProduct(품목, "default_prov")}
                    {@render resetBtn(품목, "default_prov")}
                  </td>
                  <td class:peruser={수정여부확인(품목, "discount_margin")}>
                    {@render eachProduct(품목, "discount_margin")}
                    {@render resetBtn(품목, "discount_margin")}
                    <button
                      class="link"
                      tabindex="-1"
                      onclick={() => {
                        if (품목.default_margin && typeof 품목.default_margin == "object") 품목.default_margin.link_disc = !품목.default_margin.link_disc;
                        변경된행.set(품목.no_id, 품목);
                      }}
                      aria-label="할인마진-공급가 자동계산"
                      ><i class={["fas", 품목.default_margin?.link_disc ? "fa-link" : "fa-unlink"]}></i>
                      <b>할인마진↔︎공급가 자동계산</b>
                    </button>
                  </td>
                  <td class:peruser={수정여부확인(품목, "discount_price")}>
                    {@render eachProduct(품목, "discount_price")}
                    {@render resetBtn(품목, "discount_price")}
                  </td>
                  <td class:peruser={수정여부확인(품목, "discount_qty")}>
                    {@render eachProduct(품목, "discount_qty")}
                    {@render resetBtn(품목, "discount_qty")}
                  </td>
                  <td>
                    <div>
                      <input
                        type="text"
                        onchange={() => 행업데이트(품목)}
                        bind:value={
                          () => 로케일숫자로표시((품목.default_margin as Types.마진타입).brand_disc_amount),
                          (v: string | number | undefined) => {
                            (품목.default_margin as Types.마진타입).brand_disc_amount = 숫자로변환(v);
                          }
                        } />
                    </div>
                    {@render resetBtn(품목, "brand_disc_amount")}
                  </td>
                {/if}
              </tr>
              {#if 아이디별마진열림[품목.PROD_CD]}
                <tr class="margin_details_operation dim" in:fly={{ y: -10, duration: 200 }}>
                  <td colspan="8">
                    <button class="button">현재 품목에 대해 업체 별 설정 값 초기화</button>
                    <button class="button">현재 품목에 설정된 업체들 선택하기</button>
                  </td>
                </tr>
                {#each Object.keys(품목.default_margin.per_user) as 각아이디}
                  <tr class="margin_details dim">
                    <td>
                      <div><span>{아이디목록캐싱[각아이디]}</span></div>
                    </td>
                    <td></td>
                    <td>{@render eachProduct(품목, "default_margin", 각아이디)}</td>
                    <td>{@render eachProduct(품목, "default_prov", 각아이디)}</td>
                    <td>{@render eachProduct(품목, "discount_margin", 각아이디)}</td>
                    <td>{@render eachProduct(품목, "discount_price", 각아이디)}</td>
                    <td>{@render eachProduct(품목, "discount_qty", 각아이디)}</td>
                    <td></td>
                  </tr>
                {/each}
              {/if}
            {/each}
          </tbody>
        {/if}
      </table>
    </div>
  {:else}
    <div class="nobrand">좌측 사이드바를 클릭하여 브랜드를 선택하세요.</div>
  {/if}
</div>
{#if 적용반환값}
  <Portal target=".successful-popup">
    <div>
      <div>아래 품목에 적용되었습니다.</div>
      <details>
        <summary>적용된 품목 보기</summary>
        <div>
          <code>
            <pre>{적용반환값.data?.join("\n")}</pre>
          </code>
        </div>
      </details>
    </div>
  </Portal>
{/if}
{#if 마진설정값가져오기팝업열림}
  <Portal target=".margin_import_popup">
    <div>
      <p>마진 설정값을 가져올 아이디를 선택하세요:</p>
      <p>
        <input
          type="text"
          bind:value={마진설정값가져올아이디}
          {@attach node => {
            const selectbox = new TomSelect(node, {
              valueField: "mb_id",
              labelField: "mb_nick",
              searchField: ["mb_id", "mb_nick"],
              options: 아이디목록,
              maxItems: 1,
              closeAfterSelect: true,
              dropdownParent: "body",
              refreshThrottle: 0,
              placeholder: "아이디 선택...",
            });
            return () => {
              selectbox.destroy();
            };
          }} />
      </p>
      <hr />
      <p>선택된 아이디 <code>{마진설정값가져올아이디}</code>에서 마진 설정값을<br /><code>{선택된아이디.join(", ")}</code>로 가져옵니다.</p>
    </div>
  </Portal>
{/if}

<style>
  @import "./app.css";
  @import "./common.css";
</style>
