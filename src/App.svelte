<script lang="ts">
  import TomSelect from "tom-select";
  import "tom-select/dist/css/tom-select.css";
  import Swal from "sweetalert2";
  import Sidebar from "./sidebar.svelte";
  import {onMount} from "svelte";
  import {SvelteSet} from "svelte/reactivity";

  interface 개별품목타입 {
    no_id: number;
    brand: string;
    PROD_CD: string;
    product: string;
    hidden: number;
    stock: number;
    soldout: number;
    price: number;
    default_margin: string | 마진타입;
  }

  interface 품목목록타입 {
    [key: string]: 개별품목타입[];
  }

  interface 마진타입 {
    default_margin: number | string | undefined;
    default_prov: number | string | undefined;
    discount_qty: number | string | undefined;
    brand_disc_amount: number | string | undefined;
    discount_margin: number | string | undefined;
    discount_price: number | string | undefined;
    per_user: {
      [key: string]: {
        discount_margin: number | string | undefined;
        discount_price: number | string | undefined;
      };
    };
  }

  let 품목목록: 품목목록타입 = $state({});
  let 품목목록사본: 품목목록타입 = $state({});

  let 브랜드: string[] | undefined = $state([]);

  let 선택된브랜드: string | undefined = $state();
  let 선택된브랜드품목 = $derived(선택된브랜드 ? 품목목록 && 품목목록[선택된브랜드] : undefined);

  let 변경된행 = new SvelteSet<개별품목타입>();

  let 마진공급가자동계산 = $state(false);

  interface 아이디목록타입 {
    mb_no: string;
    mb_id: string;
    mb_nick: string;
    mb_8: string;
  }

  let 아이디목록: 아이디목록타입[] | undefined = $state([]);

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
      placeholder: "아이디 선택... (복수 선택 가능)",
      onChange: (value: string[]) => (선택된아이디 = value),
      maxOptions: undefined,
    });
  });

  let 선택된아이디: string[] = $state([]);

  interface 품목테이블컬럼속성타입 {
    [key: string]: {
      width: string;
      display: boolean;
      label: string;
    };
  }

  let 품목테이블컬럼속성: 품목테이블컬럼속성타입 = $derived({
    no_id: {width: "0%", display: false, label: ""},
    품목명: {width: "30%", display: true, label: "품목명"},
    소비자가: {width: "10%", display: true, label: "소비자가(원)"},
    기본마진: {width: "10%", display: true, label: "기본 마진(%)"},
    기본공급가: {width: "10%", display: true, label: "기본 공급가(원)"},
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
    할인수량: {width: "10%", display: true, label: "할인 수량(개)"},
    브랜드할인최소액: {
      width: "10%",
      display: true,
      label: "브랜드 할인 최소액(원)",
    },
  });

  let 브랜드일괄편집필드: Omit<마진타입, "per_user"> = $state({
    default_margin: undefined,
    default_prov: undefined,
    discount_qty: undefined,
    discount_margin: undefined,
    discount_price: undefined,
    brand_disc_amount: undefined,
  });

  let 내용변경여부 = $state(false);

  function 브랜드일괄편집필드리셋() {
    브랜드일괄편집필드 = {
      default_margin: undefined,
      default_prov: undefined,
      discount_qty: undefined,
      discount_margin: undefined,
      discount_price: undefined,
      brand_disc_amount: undefined,
    };
  }

  async function 품목목록가져오기() {
    브랜드 = [];
    try {
      const 가져오기 = await fetch("https://b2b.soundcat.com/page/get_products.php", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          key: "b2b_margin_setup",
        }),
      });

      if (가져오기.ok) {
        const 결과: 품목목록타입 = await 가져오기.json();
        브랜드 = 결과 && Object.keys(결과);
        브랜드.forEach((아이템) => {
          품목목록[아이템] = 결과[아이템].map((아이템: 개별품목타입) => {
            let default_margin;
            try {
              if (typeof 아이템.default_margin == "string") {
                default_margin = JSON.parse(아이템.default_margin);

                if (typeof default_margin != "object") throw new Error("마진 란이 객채가 아닙니다.");
              } else {
                throw new Error("마진 란이 비어있습니다.");
              }
            } catch (e) {
              default_margin = {
                default_margin: 0,
                default_prov: 0,
                discount_qty: 0,
                discount_margin: 0,
                discount_price: 0,
                brand_disc_amount: 0,
                per_user: {},
              };
            }
            return {
              ...아이템,
              default_margin,
            };
          });
        });
        품목목록사본 = structuredClone($state.snapshot(품목목록));
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
          "Use-Dev": "true",
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

  function 유저별엔트리생성(품목: 개별품목타입, 아이디: string) {
    if (typeof 품목.default_margin != "object") return;

    if (!품목.default_margin.per_user?.[아이디])
      품목.default_margin.per_user[아이디] = {
        discount_margin: -1,
        discount_price: -1,
      };
  }

  function 할인마진겟터(품목: 개별품목타입, 숫자로반환: boolean | undefined = false) {
    if (typeof 품목.default_margin != "object") return;
    if (선택된아이디.length == 0) {
      return 숫자로반환 ? 품목.default_margin.discount_margin : 로케일숫자로표시(품목.default_margin.discount_margin);
    } else if (선택된아이디.length == 1) {
      return 숫자로반환 ? 품목.default_margin.per_user?.[선택된아이디[0]]?.discount_margin : 로케일숫자로표시(품목.default_margin.per_user?.[선택된아이디[0]]?.discount_margin);
    } else {
      const 첫번째아이디값 = 선택된아이디.length ? 품목.default_margin.per_user?.[선택된아이디[0]]?.discount_margin : undefined;
      for (const 각아이디 of 선택된아이디) {
        if (첫번째아이디값 != 품목.default_margin.per_user?.[각아이디]?.discount_margin) return undefined;
      }
      return 숫자로반환 ? 첫번째아이디값 : 로케일숫자로표시(첫번째아이디값);
    }
  }

  function 할인공급가겟터(품목: 개별품목타입, 숫자로반환: boolean | undefined = false) {
    if (typeof 품목.default_margin != "object") return;
    if (선택된아이디.length == 0) {
      return 숫자로반환 ? 품목.default_margin.discount_price : 로케일숫자로표시(품목.default_margin.discount_price);
    } else if (선택된아이디.length == 1) {
      return 숫자로반환 ? 품목.default_margin.per_user?.[선택된아이디[0]]?.discount_price : 로케일숫자로표시(품목.default_margin.per_user?.[선택된아이디[0]]?.discount_price);
    } else {
      const 첫번째아이디값 = 선택된아이디.length ? 품목.default_margin.per_user?.[선택된아이디[0]]?.discount_price : undefined;
      for (const 각아이디 of 선택된아이디) {
        if (첫번째아이디값 != 품목.default_margin.per_user?.[각아이디]?.discount_price) return undefined;
      }
      return 숫자로반환 ? 첫번째아이디값 : 로케일숫자로표시(첫번째아이디값);
    }
  }

  function 할인마진셋터(v: string | number | undefined, 품목: 개별품목타입 | 개별품목타입[]) {
    const 세팅할품목 = Array.isArray(품목) ? 품목 : [품목];

    세팅할품목.forEach((품목) => {
      if (typeof 품목.default_margin != "object") return;
      if (선택된아이디.length == 0) {
        품목.default_margin.discount_margin = 숫자로변환(v ?? 품목.default_margin.default_margin);
        if (마진공급가자동계산) 품목.default_margin.discount_price = parseFloat(String(품목.price)) * ((100 - parseFloat(String(숫자로변환(v ?? 품목.default_margin.default_margin)))) / 100);
      } else if (선택된아이디.length == 1) {
        유저별엔트리생성(품목, 선택된아이디[0]);
        품목.default_margin.per_user[선택된아이디[0]].discount_margin = 숫자로변환(v ?? 품목.default_margin.default_margin);
        if (마진공급가자동계산) 품목.default_margin.per_user[선택된아이디[0]].discount_price = parseFloat(String(품목.price)) * ((100 - parseFloat(String(품목.default_margin.per_user[선택된아이디[0]].discount_margin))) / 100);
      } else {
        선택된아이디.forEach((element) => {
          if (typeof 품목.default_margin != "object") return;
          유저별엔트리생성(품목, element);
          품목.default_margin.per_user[element].discount_margin = 숫자로변환(v ?? 품목.default_margin.default_margin);
          if (마진공급가자동계산) 품목.default_margin.per_user[element].discount_price = parseFloat(String(품목.price)) * ((100 - parseFloat(String(품목.default_margin.per_user[element].discount_margin))) / 100);
        });
      }
      변경된행.add(품목);
    });
  }

  function 할인공급가셋터(v: string | number | undefined, 품목: 개별품목타입 | 개별품목타입[]) {
    const 세팅할품목 = Array.isArray(품목) ? 품목 : [품목];

    세팅할품목.forEach((품목) => {
      if (typeof 품목.default_margin != "object") return;
      if (선택된아이디.length == 0) {
        품목.default_margin.discount_price = 숫자로변환(v ?? 품목.default_margin.default_margin);
        품목.default_margin.discount_margin = 100 - (parseFloat(String(품목.default_margin.discount_price)) / parseFloat(String(품목.price))) * 100;
      } else if (선택된아이디.length == 1) {
        유저별엔트리생성(품목, 선택된아이디[0]);
        품목.default_margin.per_user[선택된아이디[0]].discount_price = 숫자로변환(v ?? 품목.default_margin.default_prov);
        품목.default_margin.per_user[선택된아이디[0]].discount_margin = 100 - (parseFloat(String(품목.default_margin.per_user[선택된아이디[0]].discount_price)) / parseFloat(String(품목.price))) * 100;
      } else {
        선택된아이디.forEach((element) => {
          if (typeof 품목.default_margin != "object") return;
          유저별엔트리생성(품목, element);
          품목.default_margin.per_user[element].discount_price = 숫자로변환(v ?? 품목.default_margin.default_prov);
          품목.default_margin.per_user[element].discount_margin = 100 - (parseFloat(String(품목.default_margin.per_user[element].discount_price)) / parseFloat(String(품목.price))) * 100;
        });
      }
      변경된행.add(품목);
    });
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

  function 브랜드값일괄편집<Target extends Exclude<keyof 마진타입, "per_user">>(값: string | number, 타겟: Target) {
    선택된브랜드품목?.forEach((품목) => {
      (품목.default_margin as 마진타입)[타겟] = 숫자로변환(값);
      if (마진공급가자동계산) {
        if (typeof 품목.default_margin != "object") return;
        switch (타겟) {
          case "default_margin":
            품목.default_margin.default_prov = parseFloat(String(품목.price)) * ((100 - parseFloat(String(품목.default_margin.default_margin))) / 100);
            break;
          case "default_prov":
            품목.default_margin.default_margin = 100 - (parseFloat(String(품목.default_margin.default_prov)) / parseFloat(String(품목.price))) * 100;
            break;
        }
      }
      변경된행.add(품목);
    });
  }

  function 행업데이트(품목: 개별품목타입, 타겟: "default_margin" | "default_prov" | undefined = undefined) {
    if (마진공급가자동계산 && 타겟) {
      if (typeof 품목.default_margin != "object") return;
      switch (타겟) {
        case "default_margin":
          품목.default_margin.default_prov = parseFloat(String(품목.price)) * ((100 - parseFloat(String(품목.default_margin.default_margin))) / 100);
          break;
        case "default_prov":
          품목.default_margin.default_margin = 100 - (parseFloat(String(품목.default_margin.default_prov)) / parseFloat(String(품목.price))) * 100;
          break;
      }
    }
    변경된행.add(품목);
  }

  onMount(async () => {
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
</script>

<section class="app-section">
  <Sidebar {브랜드} bind:선택된브랜드 품목목록가져오기={품목목록가져오기} />
  <div class="app-toolbar">
    <div class="app-user-select-container">
      <select multiple class="app-user-select" bind:this={아이디입력상자}> </select>
    </div>
    <div class="app-submit-div">
      <label class="app-checkbox-label"> <input type="checkbox" bind:checked={마진공급가자동계산} />마진↔︎공급가 자동계산</label>
      <button
        type="button"
        class={["cancel", 내용변경여부 || "disabled"]}
        onclick={() => {
          변경된행.clear();
          품목목록 = structuredClone($state.snapshot(품목목록사본));
          브랜드일괄편집필드리셋();
        }}><i class="fas fa-redo"></i> 변경 취소</button>
      <button type="button" class={["submit", 내용변경여부 || "disabled"]} onclick={() => console.log(JSON.stringify(Array.from(변경된행)))}>
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
  {#if 선택된브랜드 && 선택된브랜드품목}
    <div class="app-table-container">
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
          <tr>
            <td
              ><div>
                <span><b>{선택된브랜드} 브랜드 전체 수정</b> (값 입력 후 엔터)</span>
              </div></td>
            <td></td>
            <td>
              <div>
                <input
                  type="text"
                  onchange={(e) => 브랜드값일괄편집(e.currentTarget.value, "default_margin")}
                  bind:value={
                    () => 로케일숫자로표시(브랜드일괄편집필드.default_margin),
                    (v) => {
                      브랜드일괄편집필드.default_margin = 숫자로변환(v);
                    }
                  } />
              </div></td>
            <td>
              {#if false}
                <div>
                  <input
                    type="text"
                    onchange={(e) => 브랜드값일괄편집(e.currentTarget.value, "default_prov")}
                    bind:value={
                      () => 로케일숫자로표시(브랜드일괄편집필드.default_prov),
                      (v) => {
                        브랜드일괄편집필드.default_prov = 숫자로변환(v);
                      }
                    } />
                </div>
              {/if}
            </td>
            <td>
              <div>
                <input
                  type="text"
                  onchange={(e) => 할인마진셋터(e.currentTarget.value, 선택된브랜드품목)}
                  bind:value={
                    () => 로케일숫자로표시(브랜드일괄편집필드.discount_margin),
                    (v) => {
                      브랜드일괄편집필드.discount_margin = 숫자로변환(v);
                    }
                  } />
              </div></td>
            <td>
              {#if false}
                <div>
                  <input
                    type="text"
                    onchange={(e) => 할인공급가셋터(e.currentTarget.value, 선택된브랜드품목 as 개별품목타입[])}
                    bind:value={
                      () => 로케일숫자로표시(브랜드일괄편집필드.discount_price),
                      (v) => {
                        브랜드일괄편집필드.discount_price = 숫자로변환(v);
                      }
                    } />
                </div>
              {/if}
            </td>
            <td>
              <div>
                <input
                  type="text"
                  onchange={(e) => 브랜드값일괄편집(e.currentTarget.value, "discount_qty")}
                  bind:value={
                    () => 로케일숫자로표시(브랜드일괄편집필드.discount_qty),
                    (v) => {
                      브랜드일괄편집필드.discount_qty = 숫자로변환(v);
                    }
                  } />
              </div></td>
            <td>
              <div>
                <input
                  type="text"
                  onchange={(e) => 브랜드값일괄편집(e.currentTarget.value, "brand_disc_amount")}
                  bind:value={
                    () => 로케일숫자로표시(브랜드일괄편집필드.brand_disc_amount),
                    (v) => {
                      브랜드일괄편집필드.brand_disc_amount = 숫자로변환(v);
                    }
                  } />
              </div></td>
          </tr>
          {#each 선택된브랜드품목 as 품목}
            <tr>
              <td><div><span>{품목.product}</span></div></td>
              <td>
                <div style="text-align: center;">
                  <span>{Intl.NumberFormat("ko-KR").format(품목.price)}</span>
                </div></td>
              {#if typeof 품목.default_margin == "object"}
                <td>
                  <div>
                    <input
                      type="text"
                      onchange={() => 행업데이트(품목, "default_margin")}
                      bind:value={
                        () => 로케일숫자로표시((품목.default_margin as 마진타입).default_margin),
                        (v) => {
                          (품목.default_margin as 마진타입).default_margin = 숫자로변환(v);
                        }
                      } />
                  </div></td>
                <td>
                  <div>
                    <input
                      type="text"
                      onchange={() => 행업데이트(품목, "default_prov")}
                      bind:value={
                        () => 로케일숫자로표시((품목.default_margin as 마진타입).default_prov),
                        (v) => {
                          (품목.default_margin as 마진타입).default_prov = 숫자로변환(v);
                        }
                      } />
                  </div></td>
                <td>
                  <div>
                    <input
                      type="text"
                      onchange={() => 행업데이트(품목)}
                      bind:value={
                        () => 할인마진겟터(품목),
                        (v) => {
                          할인마진셋터(v, 품목);
                        }
                      } />
                  </div></td>
                <td>
                  <div>
                    <input
                      type="text"
                      onchange={() => 행업데이트(품목)}
                      bind:value={
                        () => 할인공급가겟터(품목),
                        (v) => {
                          할인공급가셋터(v, 품목);
                        }
                      } />
                  </div></td>
                <td>
                  <div>
                    <input
                      type="text"
                      onchange={() => 행업데이트(품목)}
                      bind:value={
                        () => 로케일숫자로표시((품목.default_margin as 마진타입).discount_qty),
                        (v) => {
                          (품목.default_margin as 마진타입).discount_qty = 숫자로변환(v);
                        }
                      } />
                  </div></td>
                <td>
                  <div>
                    <input
                      type="text"
                      onchange={() => 행업데이트(품목)}
                      bind:value={
                        () => 로케일숫자로표시((품목.default_margin as 마진타입).brand_disc_amount),
                        (v) => {
                          (품목.default_margin as 마진타입).brand_disc_amount = 숫자로변환(v);
                        }
                      } />
                  </div></td>
              {/if}
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}
</section>

<style>
  .app-section {
    position: relative;
  }
  .app-toolbar {
    display: flex;
    gap: 1em;
    margin-top: 1em;
    justify-content: flex-end;
    flex-wrap: wrap;
  }
  .app-user-select-container {
    flex-grow: 1;
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
  }
  .app-checkbox-label input[type="checkbox"] {
    width: 0;
    height: 0;
    overflow: hidden;
  }
  .app-checkbox-label:has(input[type="checkbox"])::before {
    content: "";
    display: inline-block;
    width: 1em;
    height: 1em;
    border-radius: 4px;
    border: 2px solid #ddd;
  }
  .app-checkbox-label:has(input[type="checkbox"]:checked)::after {
    content: "";
    position: absolute;
    display: inline-block;
    width: calc(1em - 2px);
    height: calc(1em - 2px);
    left: 3px;
    top: 3px;
    border-radius: 3px;
    background: rgb(10, 127, 251);
  }
  .app-checkbox-label:has(input[type="checkbox"]):hover::before {
    border: 2px solid #bbb;
  }
  .app-checkbox-label:has(input[type="checkbox"]:focus)::before {
    border: 2px solid rgb(10, 127, 251) !important;
  }
  .app-checkbox-label:has(input[type="checkbox"]:active)::before {
    background: #eee;
  }
  .app-checkbox-label:has(input[type="checkbox"]:checked)::before {
    border: 2px solid rgb(10, 127, 251);
  }
  .app-checkbox-label:has(input[type="checkbox"]:checked):hover::after {
    background: rgb(95, 164, 237);
  }
  .app-checkbox-label:has(input[type="checkbox"]:active:checked)::after {
    background: rgb(16, 99, 189);
  }
  .app-submit-div button {
    border: none;
    border-radius: 5px;
    font-size: 1em;
    padding: 0.5em 1em;
    background: #eee;
    box-shadow: 0 2px 4px #0003;
  }
  .app-submit-div :is(button:hover, button:focus) {
    filter: brightness(1.1);
  }
  .app-submit-div button:active {
    filter: brightness(1);
    transform: translateY(1px);
  }
  .app-submit-div button.disabled {
    opacity: 0.5;
    cursor: not-allowed;
    pointer-events: none;
  }
  .app-submit-div button.cancel {
    background: rgb(179, 34, 34);
    color: white;
  }
  .app-submit-div button.submit {
    background: rgb(20, 185, 20);
    color: white;
  }
  .app-table-container {
    margin-top: 1em;
    overflow-x: auto;
    height: calc(100vh - calc(160px + 5em));
    overflow-y: auto;
  }
  .app-table {
    width: 100%;
    min-width: 1024px;
    border-collapse: collapse;
  }
  .app-table thead {
    background: #eee;
    box-shadow: 0 2px 4px #0002;
    position: sticky;
    top: 0;
  }
  .app-table tr {
    border-bottom: 1px solid #ddd;
  }
  .app-table :is(th, td) {
    height: 1em;
  }
  .app-table :is(th, td) div {
    padding: 0.5em;
  }
  .app-table :is(th, td) span {
    padding: 0.5em;
    word-break: keep-all;
    overflow-wrap: break-word;
  }
  .app-table td input[type="text"] {
    width: 100%;
    display: block;
    font-size: 1em;
    padding: 0.5em;
    border: none;
    outline: none;
    border-bottom: 2px solid #eee;
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
    transition: border 0s;
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
  @media screen and (max-width: 529px) {
    .app-table-container {
      height: calc(100vh - calc(160px + 7em));
    }
  }
</style>
