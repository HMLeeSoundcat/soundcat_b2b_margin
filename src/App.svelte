<script lang="ts">
  import TomSelect from "tom-select";
  import "tom-select/dist/css/tom-select.css";
  import Swal from "sweetalert2";
  import Sidebar from "./sidebar.svelte";
  import { onMount } from "svelte";
  import { SvelteMap } from "svelte/reactivity";
  import Portal from "svelte-portal";

  import * as Types from "./types";

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
  let 선택된브랜드품목 = $derived.by(() => {
    if (!선택된브랜드) return;

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
  });

  let 변경된행 = new SvelteMap<Types.개별품목타입["no_id"], Types.개별품목타입>();
  if (useDev) $inspect(변경된행);

  let 마진공급가자동계산 = $derived(선택된브랜드품목?.every(품목 => 품목.default_margin && typeof 품목.default_margin == "object" && 품목.default_margin.link_def && 품목.default_margin.link_disc));

  let 아이디목록: Types.아이디목록타입[] | undefined = $state([]);
  let 아이디목록캐싱 = $derived.by(() => {
    const obj: { [key: string]: string } = {};
    아이디목록?.forEach(element => {
      obj[element.mb_id] = element.mb_nick;
    });
    return obj;
  });

  let 아이디입력상자: HTMLSelectElement | undefined = $state();
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
        if (브랜드파라미터) 선택된브랜드 = 브랜드파라미터;
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
      아이디목록 = undefined;
    }
  }

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

  function 마진값겟터(품목: Types.개별품목타입 | Types.개별품목타입[], 유형: keyof Omit<Types.마진설정값타입, "brand_disc_amount">) {
    const 게팅할품목 = Array.isArray(품목) ? 품목 : [품목];
    let 반환할값;

    for (품목 of 게팅할품목) {
      if (선택된아이디.length == 0) {
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

  function 마진값셋터(v: string | number | undefined, 품목: Types.개별품목타입 | Types.개별품목타입[], 유형: keyof Types.마진설정값타입) {
    const 세팅할품목 = Array.isArray(품목) ? 품목 : [품목];
    let 링크값: keyof Types.마진설정값타입 | undefined = undefined;
    let 링크타겟: "link_def" | "link_disc" = "link_def";
    let 링크값가격계산여부: boolean = false;

    const 링크값계산 = (링크값가격계산여부: boolean, 소비자가: number, 마진: string | number | undefined, 할인가: string | number | undefined) => {
      if (링크값가격계산여부) {
        return parseFloat(String(소비자가)) * ((100 - parseFloat(String(숫자로변환(v ?? 마진)))) / 100);
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
      let 마진설정할품목들: Omit<Types.마진설정값타입, "brand_disc_amount">[] = [];

      if (선택된아이디.length == 0) {
        마진설정할품목들.push(품목.default_margin);
      } else {
        for (const 각아이디 of 선택된아이디) {
          유저별엔트리생성(품목, 각아이디);
          마진설정할품목들.push(품목.default_margin.per_user[각아이디]);
        }
      }

      for (const 마진설정할품목 of 마진설정할품목들) {
        if (유형 == "brand_disc_amount") continue;
        마진설정할품목[유형] = 숫자로변환(v ?? 품목.default_margin[유형]);
        if (품목.default_margin[링크타겟] && 링크값) 마진설정할품목[링크값] = 링크값계산(링크값가격계산여부, 품목.price, 마진설정할품목[유형], 마진설정할품목[유형]);
      }
      if (선택된아이디.length > 0) 품목.default_margin.per_user = { ...품목.default_margin.per_user };
    }
  }

  function 숫자로변환(값: string | number | undefined) {
    if (!값) return 0;
    const 반환할값 =
      String(값)
        .replace(/[^0-9.]/g, "")
        .replace(/\.\.+/g, ".") || "0";
    const 파싱한값 = parseFloat(반환할값);
    return (반환할값.match(/\./g) || []).length == 1 && 반환할값.endsWith(".") ? 반환할값 : 파싱한값;
  }

  function 로케일숫자로표시(값: string | number | undefined) {
    if (!값) return 0;
    return String(값).endsWith(".") ? 값 : Intl.NumberFormat("ko-KR").format(parseFloat(String(값)));
  }

  function 브랜드값일괄편집<Target extends Exclude<keyof Types.마진타입, "per_user"> & Exclude<keyof Types.마진타입, "link_def"> & Exclude<keyof Types.마진타입, "link_disc">>(값: string | number, 타겟: Target) {
    선택된브랜드품목?.forEach(품목 => {
      (품목.default_margin as Types.마진타입)[타겟] = 숫자로변환(값);
      변경된행.set($state.snapshot(품목).no_id, $state.snapshot(품목));
    });
  }

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
          denyButtonText: "10분간 작게 알림",
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
      변경된행.set($state.snapshot(품목).no_id, $state.snapshot(품목));
    }
  }

  function 수정여부확인(품목: Types.개별품목타입, 항목: keyof Omit<Types.마진설정값타입, "brand_disc_amount">) {
    let 반환할값 = false;
    for (const 각아이디 of 선택된아이디) {
      if (반환할값 == false && 품목?.default_margin && typeof 품목?.default_margin == "object" && 품목.default_margin.per_user?.[각아이디]?.[항목] && 품목.default_margin[항목] != 품목.default_margin.per_user?.[각아이디]?.[항목]) 반환할값 = true;
    }

    return 반환할값;
  }

  async function 적용() {
    적용중여부 = true;
    try {
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
        await Swal.fire({
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
        변경된행.clear();
        품목목록사본 = structuredClone($state.snapshot(품목목록));
      } else {
        throw new Error("서버에 접속하지 못했습니다: " + JSON.stringify(요청));
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

  async function 상세DB가져오기() {
    if (!상세DB데이터) 상세DB데이터 = {};
    let page = 1;
    while (true) {
      try {
        const 요청 = await fetch("https://b2b.soundcat.com/bbs/board.php?bo_table=prod_db&api=json&scope=href,wr_2&page=" + page + (useDev ? "&usedev=true" : ""), {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
        });

        if (요청.ok) {
          const 결과 = await 요청.json();

          if (결과.status == "success") {
            const 데이터 = 결과.data;
            for (const 항목 of 데이터) {
              if (항목["wr_2"]) {
                try {
                  const 항목나열 = JSON.parse(항목["wr_2"]);
                  if (Array.isArray(항목나열)) {
                    for (const element of 항목나열) {
                      상세DB데이터[element] = 항목["href"];
                    }
                  }
                } catch (e) {
                  상세DB데이터[항목["wr_2"]] = 항목["href"];
                }
              }
            }
            page++;
          } else {
            throw new Error("상세DB 목록 조회 실패");
          }
        } else {
          throw new Error("상세DB 서버 접속 실패");
        }
      } catch (e) {
        console.log(e);
        break;
      }
    }
  }

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

  function 포인터업(e: PointerEvent) {
    if ((e.target as HTMLElement).nodeName == "INPUT") {
      (e.target as HTMLInputElement)?.select();
    }
  }

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
    상세DB가져오기();
    품목목록가져오기();
    await 아이디가져오기();
  });

  $effect(() => {
    if (아이디선택상자 && 아이디목록 && 아이디목록.length > 0) {
      아이디선택상자.addOptions(아이디목록);
    }
  });

  $effect(() => {
    if (선택된브랜드) 브랜드일괄편집필드리셋();
  });
  $effect(() => {
    if (선택된아이디) 브랜드일괄편집필드리셋();
  });

  $effect(() => {
    내용변경여부 = 변경된행.size > 0 ? true : false;
  });

  $effect(() => {
    if (품목목록 && 상세DB데이터) {
      for (const 브랜드항목 of Object.entries(품목목록)) {
        for (const 품목 of 브랜드항목[1]) 품목.href = 상세DB데이터[품목.PROD_CD];
      }
    }
  });

  $effect(() => {
    if (!선택된브랜드) return;
    const url = new URL(location.href);
    url.searchParams.set("brand", 선택된브랜드);
    history.replaceState(null, "", url.href);
  });

  $effect(() => {
    if (마진초기화팝업작게표시) setTimeout(() => (마진초기화팝업작게표시 = false), 60000);
  });
</script>

<svelte:window
  onkeydown={테이블셀상하이동}
  onpointerup={포인터업} />
<section class={["app-section", 적용중여부 && "submitting"]}>
  <Sidebar
    {브랜드}
    bind:선택된브랜드
    {품목목록가져오기} />
  <div class="app-toolbar">
    <div class="app-user-select-container">
      <select
        multiple
        class="app-user-select"
        bind:this={아이디입력상자}>
      </select>
    </div>
    <button
      type="button"
      class={["blue", 선택된아이디.length || "disabled"]}
      onclick={마진설정값가져오기팝업}>마진 설정값 가져오기</button>
    <div>
      <select
        name="item_order"
        id="item_order"
        bind:value={품목정렬방법}
        placeholder="정렬방법">
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
              변경된행.set($state.snapshot(품목).no_id, $state.snapshot(품목));
            });
          }} />선택된 브랜드 마진↔︎공급가 자동계산</label>
      <button
        type="button"
        class={["cancel", 내용변경여부 || "disabled"]}
        onclick={() => {
          변경된행.clear();
          품목목록 = structuredClone($state.snapshot(품목목록사본));
          브랜드일괄편집필드리셋();
        }}><i class="fas fa-redo"></i> 변경 취소</button>
      <button
        type="button"
        class={["submit", 내용변경여부 || "disabled"]}
        onclick={적용}>
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
        <button
          class="retry-btn"
          onclick={() => 품목목록가져오기()}><i class="fas fa-redo"></i> 재시도</button>
      </div>
    </div>
  {/if}
  {#if 아이디목록 && 아이디목록.length == 0}
    <div class="loading">아이디 목록을 가져오는 중입니다...</div>
  {:else if !아이디목록}
    <div class="failed">
      <div>아이디 목록 가져오기를 실패했습니다. 재시도하시겠습니까?</div>
      <div>
        <button
          class="retry-btn"
          onclick={() => 아이디가져오기()}><i class="fas fa-redo"></i> 재시도</button>
      </div>
    </div>
  {/if}
  {#if 선택된브랜드 && 선택된브랜드품목}
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
    {#snippet eachProduct(품목: Types.개별품목타입, target: keyof Omit<Types.마진설정값타입, "brand_disc_amount">)}
      <div>
        <input
          type="text"
          onchange={() => 행업데이트(품목, target)}
          bind:value={
            () => 마진값겟터(품목, target),
            (v: string | number | undefined) => {
              마진값셋터(v, 품목, target);
            }
          } />
      </div>
    {/snippet}
    <div
      class={["app-table-container"]}
      data-x="no"
      data-y="bottom"
      bind:this={테이블컨테이너}
      onwheel={테이블스크롤}>
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
                마진값셋터(e.currentTarget.value, 선택된브랜드품목, target);
                행업데이트(선택된브랜드품목, target);
              })}</td>
            <td></td>
            <td>
              {@render brandAll("discount_margin", (target, e) => {
                if (!(e.currentTarget instanceof HTMLInputElement)) return;
                마진값셋터(e.currentTarget.value, 선택된브랜드품목, target);
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
              <tr class:hidden={parseInt(String(품목.hidden))}>
                <td class="product_cell">
                  <div>
                    <span>
                      {품목.product}
                      {#if 품목.href}
                        <a
                          class="download_db"
                          target="_blank"
                          href={품목.href}>(상세DB 보기)</a>
                      {/if}
                    </span>
                    {#if Object.keys(품목.default_margin.per_user).length > 0}
                      <span
                        class="hasperuser"
                        data-peruser="해당 품목은 업체 별 마진값이 설정되어 있습니다.&#13;설정된 업체: {Object.keys(품목.default_margin.per_user)
                          .map(x => 아이디목록캐싱[x])
                          .join(', ')}"><i class="fas fa-exclamation-circle"></i></span>
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
                    <button
                      class="link"
                      tabindex="-1"
                      onclick={() => {
                        if (품목.default_margin && typeof 품목.default_margin == "object") 품목.default_margin.link_def = !품목.default_margin.link_def;
                        변경된행.set($state.snapshot(품목).no_id, $state.snapshot(품목));
                      }}
                      aria-label="기본마진-공급가 자동계산"
                      ><i class={["fas", 품목.default_margin?.link_def ? "fa-link" : "fa-unlink"]}></i>
                      <b>기본마진↔︎공급가 자동계산</b>
                    </button>
                  </td>
                  <td class:peruser={수정여부확인(품목, "default_prov")}>
                    {@render eachProduct(품목, "default_prov")}
                  </td>
                  <td class:peruser={수정여부확인(품목, "discount_margin")}>
                    {@render eachProduct(품목, "discount_margin")}
                    <button
                      class="link"
                      tabindex="-1"
                      onclick={() => {
                        if (품목.default_margin && typeof 품목.default_margin == "object") 품목.default_margin.link_disc = !품목.default_margin.link_disc;
                        변경된행.set($state.snapshot(품목).no_id, $state.snapshot(품목));
                      }}
                      aria-label="할인마진-공급가 자동계산"
                      ><i class={["fas", 품목.default_margin?.link_disc ? "fa-link" : "fa-unlink"]}></i>
                      <b>할인마진↔︎공급가 자동계산</b>
                    </button>
                  </td>
                  <td class:peruser={수정여부확인(품목, "discount_price")}> {@render eachProduct(품목, "discount_price")}</td>
                  <td class:peruser={수정여부확인(품목, "discount_qty")}> {@render eachProduct(품목, "discount_qty")}</td>
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
                    </div></td>
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
</section>
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
  .app-section {
    position: relative;
  }
  .app-section::after {
    content: "";
    opacity: 0;
    color: transparent;
    transition:
      color 0.2s,
      opacity 0.2s;
  }
  .app-section.submitting::after {
    content: "적용중입니다...";
    position: absolute;
    width: 100%;
    height: 100%;
    top: 0;
    left: 0;
    background: #fffa;
    backdrop-filter: blur(4px);
    -webkit-backdrop-filter: blur(4px);
    color: black;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.5em;
    opacity: 1;
    z-index: 9999;
  }
  .app-toolbar {
    display: flex;
    gap: 1em;
    margin-top: 1em;
    justify-content: flex-end;
    align-items: center;
    flex-wrap: wrap;
  }
  .app-user-select-container {
    flex-grow: 1;
  }

  select.app-user-select {
    width: 0;
    height: 0;
    display: none;
  }
  .app-submit-div {
    display: flex;
    align-items: center;
    gap: 0.5em;
  }
  .app-checkbox-label {
    display: flex;
    align-items: center;
    position: relative;
    gap: 0.2em;
  }
  .app-checkbox-label input[type="checkbox"] {
    width: 0;
    height: 0;
    overflow: hidden;
    margin: 0;
  }
  .app-checkbox-label:has(input[type="checkbox"]) i {
    position: relative;
    display: flex;
    width: calc(1em + 4px);
    height: calc(1em + 4px);
    border-radius: 4px;
    border: 2px solid #ddd;
    align-items: center;
    justify-content: center;
  }
  .app-checkbox-label:has(input[type="checkbox"]:checked) i::after {
    content: "";
    display: block;
    width: calc(1em - 2px);
    height: calc(1em - 2px);
    border-radius: 3px;
    background: rgb(10, 127, 251);
  }
  .app-checkbox-label:has(input[type="checkbox"]):hover i {
    border-color: #bbb;
  }
  .app-checkbox-label:has(input[type="checkbox"]:focus) i {
    border: 2px solid rgb(10, 127, 251) !important;
  }
  .app-checkbox-label:has(input[type="checkbox"]:active) i {
    background: #eee;
  }
  .app-checkbox-label:has(input[type="checkbox"]:checked) i {
    border: 2px solid rgb(10, 127, 251);
  }
  .app-checkbox-label:has(input[type="checkbox"]:checked):hover i::after {
    background: rgb(95, 164, 237) !important;
  }
  .app-checkbox-label:has(input[type="checkbox"]:active:checked) i::after {
    background: rgb(16, 99, 189);
  }
  .app-toolbar button {
    border: none;
    border-radius: 5px;
    font-size: 1em;
    padding: 0.5em 1em;
    background: #eee;
    box-shadow: 0 2px 4px #0003;
  }
  .app-toolbar :is(button:hover, button:focus) {
    filter: brightness(1.1);
  }
  .app-toolbar button:active {
    filter: brightness(1);
    transform: translateY(1px);
  }
  .app-toolbar button.disabled {
    opacity: 0.5;
    cursor: not-allowed;
    pointer-events: none;
  }
  .app-toolbar button.blue {
    background: rgb(10, 127, 251);
    color: white;
  }
  .app-toolbar button.cancel {
    background: rgb(179, 34, 34);
    color: white;
  }
  .app-toolbar button.submit {
    background: rgb(20, 185, 20);
    color: white;
  }
  .app-table-container {
    margin-top: 1em;
    overflow-x: auto;
    height: calc(100vh - calc(216px + 5em));
    overflow-y: auto;
    position: relative;
  }
  .app-table-container::before {
    content: "";
    position: sticky;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    display: block;
    background-image: var(--x-grad), var(--y-grad);
    pointer-events: none;
    z-index: 9;
    transition: 0.2s;
  }
  :global([data-x="both"]) {
    --x-grad: var(--x-grad-start), var(--x-grad-end);
  }
  :global([data-x="left"]) {
    --x-grad: var(--x-grad-start);
  }
  :global([data-x="right"]) {
    --x-grad: var(--x-grad-end);
  }
  :global([data-y="both"]) {
    --y-grad: var(--y-grad-start), var(--y-grad-end);
  }
  :global([data-y="top"]) {
    --y-grad: var(--y-grad-start);
  }
  :global([data-y="bottom"]) {
    --y-grad: var(--y-grad-end);
  }
  :global([data-x="no"]) {
    --x-grad: linear-gradient(90deg, transparent, transparent);
  }
  :global([data-y="no"]) {
    --y-grad: linear-gradient(180deg, transparent, transparent);
  }
  .app-section {
    --x-grad-start: linear-gradient(90deg, white 0%, transparent 5%);
    --x-grad-end: linear-gradient(90deg, transparent 95%, white 100%);
    --y-grad-start: linear-gradient(180deg, transparent, transparent 5%);
    --y-grad-end: linear-gradient(180deg, transparent 95%, white 100%);
  }
  .app-table {
    width: 100%;
    min-width: 1200px;
    border-collapse: collapse;
    position: absolute;
    top: 0;
    left: 0;
  }
  .app-table thead {
    background: #eee;
    box-shadow: 0 2px 4px #0002;
    position: sticky;
    top: 0;
    z-index: 9;
    text-align: center;
  }
  .app-table tr {
    border-bottom: 1px solid #ddd;
  }
  .app-table tr.hidden .product_cell {
    color: #0005;
    position: relative;
  }
  .app-table tr.hidden .product_cell span::after {
    content: " (숨겨짐)";
  }
  .app-table :is(th, td) {
    height: 1em;
    position: relative;
  }
  .app-table :is(th, td) div {
    padding: 0.5em;
  }
  .app-table :is(th, td) span {
    word-break: keep-all;
    overflow-wrap: break-word;
  }
  .app-table td.peruser {
    background: rgba(255, 255, 0, 0.2) !important;
  }
  .app-table button.link {
    position: absolute;
    top: 50%;
    left: 100%;
    transform: translate(-50%, -50%);
    border-radius: 999px;
    color: #666;
    font-size: 0.8em;
    padding: 0.5rem;
    box-shadow: 0 2px 4px #0003;
    z-index: 2;
    opacity: 1;
    border: none;
    background: white;
    margin: 0;
    width: 2rem;
    height: 2rem;
    cursor: pointer;
  }
  .app-table button.link b {
    display: block;
    position: absolute;
    bottom: calc(100% + 5px);
    left: 50%;
    transform: translateX(-50%);
    border-radius: 5px;
    padding: 0.5em;
    color: white;
    background: #0009;
    width: max-content;
    pointer-events: none;
    opacity: 0;
    transition: 0.2s;
  }
  .app-table button.link:hover {
    filter: brightness(0.9);
  }
  .app-table button.link:hover b {
    opacity: 1;
  }
  .app-table button.link:active {
    filter: brightness(0.9);
    transform: translate(-50%, calc(-50% + 1px));
  }
  .app-table button.link i.fa-unlink {
    opacity: 0.5;
  }
  .app-table td input[type="text"] {
    width: 100%;
    display: block;
    font-size: 1em;
    padding: 0.5em;
    border: none;
    outline: none;
    border-bottom: 2px solid #eee;
    background-color: transparent;
    transition:
      border 0.2s,
      background-color 0.2s;
    text-align: center;
  }
  .app-table td input[type="text"]:hover {
    border-color: #ccc;
    background-color: #f4f4f4;
  }
  .app-table td input[type="text"]:focus {
    border-color: rgb(10, 127, 251);
    background: white;
    transition: border 0s;
  }
  .app-table tr:has(:focus) {
    background: #0001;
  }
  .loading,
  .failed {
    display: flex;
    width: 100%;
    height: 100%;
    align-items: center;
    justify-content: center;
    text-align: center;
    flex-direction: column;
    margin-top: 2em;
    gap: 1em;
  }
  .retry-btn {
    border: none;
    border-radius: 5px;
    font-size: 1em;
    padding: 0.5em 1em;
    background: rgb(20, 185, 20);
    box-shadow: 0 2px 4px #0003;
    color: white;
  }
  .retry-btn:hover,
  .retry-btn:focus {
    filter: brightness(1.1);
  }
  .retry-btn:active {
    filter: brightness(1);
    transform: translateY(1px);
  }
  .nobrand {
    width: 100%;
    height: 600px;
    background: #eee;
    border-radius: 1em;
    margin-top: 1em;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 2em;
    color: #666;
  }
  #item_order {
    display: block;
    padding: 0.5em 1em;
    border: 1px solid #ccc;
    border-radius: 3px;
    font-size: 15px;
  }
  .download_db {
    font-size: 0.8em;
    color: black;
    text-decoration: underline;
  }
  .download_db:hover {
    color: #0d6efd;
  }
  .download_db:active {
    color: black;
  }
  .hasperuser {
    position: absolute;
    top: 50%;
    right: 1em;
    transform: translateY(-50%);
    color: #f006;
    z-index: 5;
    padding: 0.2em;
  }
  .hasperuser::after {
    content: attr(data-peruser);
    position: absolute;
    top: 50%;
    left: 1.5rem;
    color: white;
    font-size: 0.8em;
    white-space: pre-wrap;
    background: #000a;
    padding: 0.5rem;
    border-radius: 0.5rem;
    border: 2px solid white;
    transform: translateY(-50%);
    box-shadow: 0 4px 8px #0003;
    opacity: 0;
    min-width: 300px;
    transition: 0.1s;
    pointer-events: none;
  }
  .hasperuser:hover::after {
    opacity: 1;
    pointer-events: unset;
  }
  :global(.ts-dropdown) {
    z-index: 99999;
  }
  @media screen and (max-width: 529px) {
    .app-table-container {
      height: calc(100vh - calc(160px + 7em));
    }
  }
</style>
