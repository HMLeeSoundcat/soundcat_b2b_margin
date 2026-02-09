<script lang="ts">
  import "tom-select/dist/css/tom-select.css";
  import Swal from "sweetalert2";
  import Sidebar from "./sidebar.svelte";
  import { onMount } from "svelte";
  import { SvelteMap } from "svelte/reactivity";
  import Portal from "svelte-portal";

  import * as Types from "./types";
  import BackupRestore from "./Backup_Restore.svelte";
  import MarginGroups from "./Margin_Groups.svelte";

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
    per_group: {},
    link_def: true,
    link_disc: true,
  };

  let 아이디목록: Types.아이디목록타입[] = $state([]);

  let 품목정렬방법: keyof typeof 품목정렬방법타입 = $state("name_asc");

  let 품목목록: Types.품목목록타입 = $state({});
  let 품목목록사본: Types.품목목록타입 = $state({});

  let 품목검색: string | undefined = $state();
  let 지연된품목검색: string | undefined = $state();

  let 브랜드: string[] | undefined = $state([]);

  let 브랜드파라미터: string | undefined | null = $state();

  let 선택된브랜드: string | undefined = $state();

  let 현재편집항목: Types.개별품목타입 | Types.개별품목타입[] | undefined = $state();
  if (useDev) $inspect(현재편집항목);

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

    let mapped = 선택된브랜드 && 품목목록?.[선택된브랜드]?.map((x, i) => 정렬방법[필드](x, i));

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

  let 변경된행 = new SvelteMap<Types.개별품목타입["no_id"], Types.개별품목타입>();
  let 편집된그룹 = new SvelteMap<Types.브랜드별마진그룹타입["uuid"], Types.브랜드별마진그룹타입>();
  // if (useDev) $inspect(변경된행);

  let 마진설정보기활성화 = $state(false);
  let 마진설정보기팝업: HTMLElement | undefined = $state();
  let 마진그룹: Types.마진그룹타입 = $state({});
  let 마진그룹선택된브랜드: Types.브랜드별마진그룹타입[] = $state([]);
  let 마진그룹갱신 = $state(false);

  let 현재마진탭: string = $state("default_margin");
  let 현재마진라벨: string | undefined = $derived(마진그룹선택된브랜드.find(x => x.uuid == 현재마진탭)?.label?.replace("기본마진", "") ?? "");

  let 마진공급가자동계산 = $derived(선택된브랜드품목?.every(품목 => 품목.default_margin && typeof 품목.default_margin == "object" && 품목.default_margin.link_def && 품목.default_margin.link_disc));

  /** 테이블 너비를 한번에 관리하고 테이블 헤드 라벨을 여기서 수정할 수 있다. 컬럼 표시 여부도 설정할 수 있다. */
  let 품목테이블컬럼속성: Types.품목테이블컬럼속성타입 = $derived({
    no_id: { width: "0%", display: false, label: "" },
    품목명: { width: "30%", display: true, label: "품목명" },
    소비자가: { width: "10%", display: true, label: "소비자가(원)" },
    기본마진: { width: "10%", display: true, label: 현재마진라벨 + " 기본 마진(%)" },
    기본공급가: { width: "10%", display: true, label: 현재마진라벨 + " 기본 공급가(원)" },
    할인마진: {
      width: "10%",
      display: true,
      label: 현재마진라벨 + " 할인 마진(%)",
    },
    할인공급가: {
      width: "10%",
      display: true,
      label: 현재마진라벨 + " 할인 공급가(원)",
    },
    할인수량: { width: "10%", display: true, label: "할인 수량(개)" },
    브랜드할인최소액: {
      width: "10%",
      display: true,
      label: "브랜드 할인 최소액(원)",
    },
  });

  let 브랜드일괄편집필드: Omit<Types.마진타입, "per_user" | "per_group"> = $state({
    default_margin: undefined,
    default_prov: undefined,
    discount_qty: undefined,
    discount_margin: undefined,
    discount_price: undefined,
    brand_disc_amount: undefined,
    link_def: true,
    link_disc: true,
  });

  let 내용변경여부 = $state(false);

  let 적용반환값:
    | {
        margin?: Types.요청반환값;
        group?: Types.요청반환값;
      }
    | undefined = $state();

  let 품목테이블바디: HTMLElement | undefined = $state();

  let 테이블컨테이너: HTMLElement | undefined = $state();
  let 테이블헤더고정여부: boolean = $state(false);

  let 앱요소: HTMLElement | undefined = $state();

  function 브랜드일괄편집필드리셋() {
    브랜드일괄편집필드 = {
      default_margin: undefined,
      default_prov: undefined,
      discount_qty: undefined,
      discount_margin: undefined,
      discount_price: undefined,
      brand_disc_amount: undefined,
      link_def: true,
      link_disc: true,
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
          scope: ["mb_id", "mb_nick"],
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
  function 그룹별엔트리생성(품목: Types.개별품목타입, 그룹: string) {
    if (typeof 품목.default_margin.per_group != "object") 품목.default_margin.per_group = {};

    if (품목.default_margin.per_group?.[그룹]) return;

    품목.default_margin.per_group[그룹] = {
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
  function 마진값겟터({ 품목, 유형, 강제형변환 = true }: { 품목: Types.개별품목타입 | Types.개별품목타입[]; 유형: keyof Omit<Types.마진설정값타입, "brand_disc_amount">; 강제형변환?: boolean }) {
    const 가져올품목 = Array.isArray(품목) ? 품목 : [품목];
    let 반환할값;

    for (품목 of 가져올품목) {
      if (현재마진탭) {
        반환할값 = 로케일숫자로표시(품목.default_margin.per_group?.[현재마진탭]?.[유형] ?? 품목.default_margin.per_group?.["default_margin"]?.[유형] ?? 품목.default_margin[유형]);
        if (!강제형변환) 반환할값 = 품목.default_margin.per_group?.[현재마진탭]?.[유형];
      } else {
        반환할값 = 로케일숫자로표시(품목.default_margin[유형]);
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
  function 마진값셋터({ 값, 품목, 유형, 리셋 = false, 입력중 = false }: { 값: string | number | undefined; 품목: Types.개별품목타입 | Types.개별품목타입[]; 유형: keyof Types.마진설정값타입; 리셋?: boolean; 입력중?: boolean }) {
    const 세팅할품목 = Array.isArray(품목) ? 품목 : [품목];
    현재편집항목 = 세팅할품목;
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
      const DISCOUNT_QTY_1 = 품목.default_margin?.per_group?.[현재마진탭]?.discount_qty == 1 || 품목.default_margin?.per_group?.default_margin?.discount_qty == 1 || (!품목.default_margin.per_group && 품목.default_margin.discount_qty == 1);

      if (리셋) {
        if (유형 == "brand_disc_amount") {
          품목.default_margin.brand_disc_amount = undefined;
          continue;
        }
        if (현재마진탭) {
          if (현재마진탭 != "default_margin") {
            품목.default_margin.per_group[현재마진탭][유형] = undefined;
            if (품목.default_margin[링크타겟] && 링크값) 품목.default_margin.per_group[현재마진탭][링크값] = undefined;
            if (DISCOUNT_QTY_1) {
              품목.default_margin.per_group[현재마진탭]["default_margin"] = undefined;
              품목.default_margin.per_group[현재마진탭]["default_prov"] = undefined;
            }
            continue;
          }
          품목.default_margin.per_group[현재마진탭][유형] = undefined;
          if (품목.default_margin[링크타겟] && 링크값) 품목.default_margin.per_group[현재마진탭][링크값] = undefined;

          if (링크값가격계산여부 && 링크값 && (유형 == "default_margin" || 유형 == "discount_margin")) 품목.default_margin.per_group[현재마진탭][링크값] = 링크값계산(링크값가격계산여부, 품목.price, 품목.default_margin[유형], 품목.default_margin[유형]);

          if (DISCOUNT_QTY_1) {
            품목.default_margin.per_group[현재마진탭]["default_margin"] = undefined;
            품목.default_margin.per_group[현재마진탭]["default_prov"] = undefined;
          }
        } else {
          품목.default_margin[유형] = undefined;
          if (품목.default_margin[링크타겟] && 링크값) 품목.default_margin[링크값] = undefined;
          if (링크값가격계산여부 && 링크값 && (유형 == "default_margin" || 유형 == "discount_margin")) 품목.default_margin[링크값] = 링크값계산(링크값가격계산여부, 품목.price, undefined, undefined);

          if (DISCOUNT_QTY_1) {
            품목.default_margin["default_margin"] = undefined;
            품목.default_margin["default_prov"] = undefined;
          }
        }
        continue;
      }

      let 마진설정할품목들: Omit<Types.마진설정값타입, "brand_disc_amount">[] = [];

      if (현재마진탭) {
        그룹별엔트리생성(품목, 현재마진탭);
        마진설정할품목들.push(품목.default_margin.per_group[현재마진탭]);
      } else {
        마진설정할품목들.push(품목.default_margin);
      }

      for (const 마진설정할품목 of 마진설정할품목들) {
        if (유형 == "brand_disc_amount") continue;
        마진설정할품목[유형] = 숫자로변환(값 ?? 품목.default_margin[유형]) as any;
        if (!입력중) 마진설정할품목[유형] = 숫자로변환(마진설정할품목[유형], true);
        if (품목.default_margin[링크타겟] && 링크값) 마진설정할품목[링크값] = 링크값계산(링크값가격계산여부, 품목.price, 마진설정할품목[유형], 마진설정할품목[유형]);

        if (DISCOUNT_QTY_1) {
          품목.default_margin.per_group[현재마진탭]["default_margin"] = 마진설정할품목["discount_margin"];
          품목.default_margin.per_group[현재마진탭]["default_prov"] = 마진설정할품목["discount_price"];
        }
      }

      if (현재마진탭) 품목.default_margin.per_group = { ...품목.default_margin.per_group };
    }

    if (리셋) 행업데이트(품목);
  }

  // 1. 오버로딩 선언
  function 숫자로변환(값: string | number | undefined, 강제파싱: true): number;
  function 숫자로변환(값: string | number | undefined, 강제파싱?: false): number | string;

  // 2. 실제 구현
  /**
   * 어떤 값이든 숫자로 반환해준다. 숫자로 반환할 수 없는 값이 들어오면 NaN이 반환된다.
   * @param 값
   */
  function 숫자로변환(값: string | number | undefined, 강제파싱: boolean = false): number | string {
    if (!값) return 0;
    const 반환할값 =
      String(값)
        .replace(/[^0-9.]/g, "")
        .replace(/\.\.+/g, ".") || "0";
    const 파싱한값 = parseFloat(반환할값);
    return 강제파싱 ? (isNaN(파싱한값) ? 0 : 파싱한값) : (반환할값.match(/\./g) || []).length == 1 && 반환할값.endsWith(".") ? 반환할값 : 파싱한값;
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
  function 브랜드값일괄편집<Target extends Exclude<keyof Types.마진타입, "per_user" | "per_group"> & Exclude<keyof Types.마진타입, "link_def"> & Exclude<keyof Types.마진타입, "link_disc">>(값: string | number, 타겟: Target) {
    선택된브랜드품목?.forEach(품목 => {
      (품목.default_margin as Types.마진타입)[타겟] = 숫자로변환(값) as any;
      변경된행.set(품목.no_id, 품목);
    });
  }

  /**
   * 값을 변경하면 업데이트가 되어야 하는 행으로 대기 배열(변경된행)에 집어넣어 준다.
   * @param 품목 개별 품목
   * @param 유형 편집된 필드
   */
  async function 행업데이트(품목: Types.개별품목타입 | Types.개별품목타입[]) {
    const 세팅할품목 = Array.isArray(품목) ? 품목 : [품목];

    for (품목 of 세팅할품목) {
      품목.edited = true;
      변경된행.set(품목.no_id, 품목);
    }
  }

  /** 서버에 변경된행 값을 전달한다. */
  async function 적용() {
    let 결과: {
      margin?: Types.요청반환값;
      group?: Types.요청반환값;
    } = {};

    적용반환값 = undefined;

    try {
      if (변경된행.size > 0) {
        const 팝업 = Swal;
        팝업.fire({
          title: "품목 마진 설정 값 적용 중...",
          showConfirmButton: false,
          allowEscapeKey: false,
          allowOutsideClick: false,
        });
        const 마진그룹UUID = 마진그룹선택된브랜드.map(y => y.uuid);
        [...변경된행.values()].forEach(x => {
          if (x.default_margin.per_group) {
            for (const uuid of Object.keys(x.default_margin.per_group)) {
              if (!마진그룹UUID.includes(uuid)) {
                delete x.default_margin.per_group[uuid];
              }
            }
          }
        });
        const 요청 = await fetch("https://b2b.soundcat.com/page/margin_setup_update.php", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Use-Dev": String(useDev),
          },
          body: JSON.stringify([...변경된행.values()]),
        });

        if (!요청.ok) throw new Error("서버에 접속하지 못했습니다: " + JSON.stringify(요청));

        결과.margin = await 요청.json();

        if (결과.margin?.status !== "success") throw new Error(JSON.stringify(결과.margin?.data));
        팝업.clickConfirm();

        [...변경된행.values()].forEach(x => delete x.edited);
        변경된행.clear();
        품목목록사본 = structuredClone($state.snapshot(품목목록));
      }

      if (편집된그룹.size > 0) {
        const 팝업 = Swal;
        팝업.fire({
          title: "마진 그룹 변경 사항 적용 중...",
          showConfirmButton: false,
          allowEscapeKey: false,
          allowOutsideClick: false,
        });
        const 요청 = await fetch("https://b2b.soundcat.com/page/product_margin_group_update.php?action=data", {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            "Use-Dev": String(useDev),
          },
          body: JSON.stringify([...편집된그룹.values()]),
        });

        if (!요청.ok) throw new Error("서버에 접속하지 못했습니다: " + JSON.stringify(요청));

        결과.group = await 요청.json();

        if (결과.group?.status !== "success") throw new Error(JSON.stringify(결과.group?.data));
        팝업.clickConfirm();

        편집된그룹.clear();
        마진그룹갱신 = true;
      }
      Swal.fire({
        icon: "success",
        title: "작업이 성공적으로 이루어졌습니다.",
        confirmButtonText: "닫기",
        customClass: {
          htmlContainer: "successful-popup",
        },
        willOpen: () => {
          적용반환값 = 결과;
        },
      });
    } catch (e) {
      console.error(e);
      Swal.fire({
        icon: "error",
        title: "적용 실패했습니다.",
        html: (e as Error).message + "<br>" + "다시 시도해보세요.",
        confirmButtonText: "닫기",
      });
    }
  }

  /** 테이블에서 상하 화살표키를 누르면 필드가 선택되게끔 해주는 함수 */
  const 테이블셀상하이동 = async (e: KeyboardEvent, trial = 0) => {
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
        타겟 = rows[rowIndex + 1 + trial].querySelectorAll("td")?.[cellIndex]?.querySelector("input");
      } else if (e.key == "ArrowUp" && rows && rowIndex > 0) {
        타겟 = rows[rowIndex - 1 - trial].querySelectorAll("td")?.[cellIndex]?.querySelector("input");
      }
      if (타겟) {
        타겟?.focus();
        setTimeout(() => 타겟?.select(), 0);
      } else {
        if (trial == 0) 테이블셀상하이동(e, 1);
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

  let tableThrottle = false;

  function 테이블스크롤(e: UIEvent) {
    if (!테이블컨테이너) return;
    const rect = 테이블컨테이너.getBoundingClientRect();
    if (rect.top <= 0) {
      테이블헤더고정여부 = true;
    } else {
      테이블헤더고정여부 = false;
    }
    테이블컨테이너.style.setProperty("--left", `${rect.left - 테이블컨테이너.scrollLeft}px`);
    const table = 테이블컨테이너.querySelector("table");
    if (table) {
      테이블컨테이너.style.setProperty("--table-width", `${table.offsetWidth}px`);
    }
  }

  onMount(async () => {
    const url = new URL(location.href);
    브랜드파라미터 = url.searchParams.get("brand");
    품목목록가져오기();
    await 아이디가져오기();
  });

  /** 선택된 브랜드가 변경되면 브랜드 일괄 편집의 각 필드를 리셋한다. */
  $effect(() => {
    if (선택된브랜드) {
      브랜드일괄편집필드리셋();
      현재마진탭 = "default_margin";
      location.hash = "default_margin";
    }
  });

  /** 변경된행 배열의 개수가 1개 이상이면 내용변경여부를 true로 아니면 false로 반환한다. */
  $effect(() => {
    내용변경여부 = 변경된행.size > 0 || 편집된그룹.size > 0 ? true : false;
  });

  /** 선택된브랜드가 없으면 GET 파라미터로부터 선택될 브랜드를 가져온다. (초기화 용) */
  $effect(() => {
    if (!선택된브랜드) return;
    const url = new URL(location.href);
    url.searchParams.set("brand", 선택된브랜드);
    history.replaceState(null, "", url.href);
  });

  $effect(() => {
    if (선택된브랜드품목) {
      선택된브랜드품목.forEach(element => {
        if (!element.default_margin.per_group) {
          element.default_margin = {
            brand_disc_amount: element.default_margin.brand_disc_amount,
            link_def: element.default_margin.link_def,
            link_disc: element.default_margin.link_disc,
            default_margin: undefined,
            default_prov: undefined,
            discount_margin: undefined,
            discount_price: undefined,
            discount_qty: undefined,
            per_user: element.default_margin.per_user,
            per_group: {
              default_margin: {
                default_margin: element.default_margin.default_margin,
                default_prov: element.default_margin.default_prov,
                discount_margin: element.default_margin.discount_margin,
                discount_price: element.default_margin.discount_price,
                discount_qty: element.default_margin.discount_qty,
              },
            },
          };
          element.edited = true;
          변경된행.set(element.no_id, element);
          Swal.fire({
            icon: "warning",
            title: "기본마진그룹 업데이트가 필요합니다.",
            text: "창을 닫고 저장을 눌러 업데이트를 진행해주세요.",
            confirmButtonText: "닫기",
          });
        }
      });
    }
  });

  let timeout: number | undefined;

  $effect(() => {
    품목검색;

    if (timeout !== undefined) clearTimeout(timeout);

    timeout = setTimeout(() => {
      지연된품목검색 = 품목검색;
    }, 200);
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
          브랜드일괄편집필드[target] = 숫자로변환(v) as any;
        }
      } />
  </div>
{/snippet}
{#snippet eachProduct(품목: Types.개별품목타입, target: keyof Omit<Types.마진설정값타입, "brand_disc_amount">)}
  <div>
    <input
      type="text"
      class={[마진값겟터({ 품목, 유형: target, 강제형변환: false }) === undefined && "no_value"]}
      onchange={() => {
        마진값셋터({ 값: 마진값겟터({ 품목, 유형: target }), 품목, 유형: target });
        행업데이트(품목);
      }}
      onkeydown={e => {
        if (e.key == "Enter") {
          마진값셋터({ 값: 마진값겟터({ 품목, 유형: target }), 품목, 유형: target });
          행업데이트(품목);
        }
      }}
      bind:value={
        () => 마진값겟터({ 품목, 유형: target }),
        (v: string | number | undefined) => {
          마진값셋터({ 값: v, 품목, 유형: target, 입력중: true });
        }
      } />
  </div>
{/snippet}
{#snippet resetBtn(품목: Types.개별품목타입, target: keyof Types.마진설정값타입)}
  <button class="reset-field" tabindex="-1" aria-label="필드 값 리셋" onclick={() => 마진값셋터({ 값: undefined, 품목, 유형: target, 리셋: true })}>
    <i class="fas fa-trash"></i>
  </button>
{/snippet}

<svelte:window
  onkeydown={테이블셀상하이동}
  onpointerup={포인터업}
  ondragover={e => e.preventDefault()}
  ondrop={e => e.preventDefault()}
  onbeforeunload={e => {
    if (!내용변경여부) return;
    e.preventDefault();
    e.returnValue = "저장하지 않은 변경 사항이 있습니다. 정말로 페이지를 떠나시겠습니까?";
    return "저장하지 않은 내용이 있습니다.";
  }}
  onscroll={e => {
    if (tableThrottle) return;
    tableThrottle = true;
    requestAnimationFrame(() => {
      테이블스크롤(e);
      tableThrottle = false;
    });
  }}
  onresize={e => {
    if (tableThrottle) return;
    tableThrottle = true;
    requestAnimationFrame(() => {
      테이블스크롤(e);
      tableThrottle = false;
    });
  }} />
<div class={["app-section", 마진설정보기활성화 && "margin_popup"]} bind:this={앱요소}>
  <Sidebar {브랜드} bind:선택된브랜드 {마진그룹} {품목목록가져오기} />
  <div class="app-toolbar">
    <div class="app-prod-search-container">
      <input type="text" bind:value={품목검색} placeholder="품목명 검색..." />
    </div>
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
                  if (!품목.default_margin.per_group[현재마진탭]) 그룹별엔트리생성(품목, 현재마진탭);
                  품목.default_margin.per_group[현재마진탭].default_prov = (품목.price * (100 - Number(숫자로변환(품목.default_margin.per_group[현재마진탭]?.default_margin)))) / 100;
                  품목.default_margin.per_group[현재마진탭].discount_price = (품목.price * (100 - Number(숫자로변환(품목.default_margin.per_group[현재마진탭]?.discount_margin)))) / 100;
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
          마진그룹갱신 = true;
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
  <MarginGroups {선택된브랜드} bind:마진그룹 bind:마진그룹선택된브랜드 bind:마진그룹갱신 bind:마진설정보기활성화 bind:마진설정보기팝업 bind:현재마진탭 {앱요소} {아이디목록} {선택된브랜드품목} {편집된그룹} {변경된행} {적용} />
  {#if 선택된브랜드 && 선택된브랜드품목}
    <div
      class={["app-table-container", 테이블헤더고정여부 && "scrolling"]}
      bind:this={테이블컨테이너}
      onscroll={e => {
        if (tableThrottle) return;
        tableThrottle = true;
        requestAnimationFrame(() => {
          테이블스크롤(e);
          tableThrottle = false;
        });
      }}>
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
                <th style="width: {품목테이블컬럼속성[컬럼명 as keyof typeof 품목테이블컬럼속성].width}">
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
                행업데이트(선택된브랜드품목);
              })}</td>
            <td></td>
            <td>
              {@render brandAll("discount_margin", (target, e) => {
                if (!(e.currentTarget instanceof HTMLInputElement)) return;
                마진값셋터({ 값: e.currentTarget.value, 품목: 선택된브랜드품목, 유형: target });
                행업데이트(선택된브랜드품목);
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
            {#each 선택된브랜드품목.filter(item => {
              if (!지연된품목검색) return true;
              if (item.product.toLowerCase().includes(지연된품목검색.toLowerCase())) return true;
            }) as 품목}
              <tr class:hidden={parseInt(String(품목.hidden))} class:edited={품목.edited}>
                <td class="product_cell">
                  <div>
                    <span>
                      {품목.product}
                    </span>
                  </div>
                </td>
                <td>
                  <div style="text-align: center;">
                    <span>{Intl.NumberFormat("ko-KR").format(품목.price)}</span>
                  </div></td>
                {#if typeof 품목.default_margin == "object"}
                  {#if 품목.default_margin.per_group[현재마진탭]?.discount_qty == 1 || 품목.default_margin.per_group["default_margin"]?.discount_qty == 1}
                    <td colspan="2">
                      <div class="no_default_margin">할인 수량: 1이므로 기본마진을 설정할 수 없습니다.</div>
                    </td>
                    <td style="display: none"></td>
                  {:else}
                    <td>
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
                    <td>
                      {@render eachProduct(품목, "default_prov")}
                      {@render resetBtn(품목, "default_prov")}
                    </td>
                  {/if}
                  <td>
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
                  <td>
                    {@render eachProduct(품목, "discount_price")}
                    {@render resetBtn(품목, "discount_price")}
                  </td>
                  <td>
                    {@render eachProduct(품목, "discount_qty")}
                    {@render resetBtn(품목, "discount_qty")}
                  </td>
                  <td>
                    <div>
                      <input
                        type="text"
                        onchange={e => {
                          마진값셋터({ 값: (e.currentTarget as HTMLInputElement).value, 품목, 유형: "brand_disc_amount" });
                          행업데이트(품목);
                        }}
                        bind:value={
                          () => 로케일숫자로표시((품목.default_margin as Types.마진타입).brand_disc_amount),
                          (v: string | number | undefined) => {
                            (품목.default_margin as Types.마진타입).brand_disc_amount = 숫자로변환(v) as any;
                          }
                        } />
                    </div>
                    {@render resetBtn(품목, "brand_disc_amount")}
                  </td>
                {/if}
              </tr>
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
      {#if 적용반환값.margin}
        <div>아래 품목에 마진 설정값이 적용되었습니다.</div>
        <details>
          <summary>적용된 품목 보기</summary>
          <div>
            <code>
              <pre>{적용반환값.margin.data?.join("\n")}</pre>
            </code>
          </div>
        </details>
      {/if}
      {#if 적용반환값.group}
        <div>아래 그룹에 변경사항이 적용되었습니다.</div>
        <details>
          <summary>적용된 그룹 보기</summary>
          <div>
            <code>
              <pre>{적용반환값.group.data?.join("\n")}</pre>
            </code>
          </div>
        </details>
      {/if}
    </div>
  </Portal>
{/if}

<style>
  @import "./app.css";
  @import "./common.css";
</style>
