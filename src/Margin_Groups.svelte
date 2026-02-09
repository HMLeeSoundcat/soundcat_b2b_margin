<script lang="ts">
  import { onMount } from "svelte";
  import Portal from "svelte-portal";
  import Swal from "sweetalert2";
  import * as Types from "./types";
  import { fly, scale } from "svelte/transition";
  import { SvelteMap } from "svelte/reactivity";
  import { flip } from "svelte/animate";

  interface Props {
    앱요소: HTMLElement | undefined;
    선택된브랜드: string | undefined;
    아이디목록: Types.확장된아이디목록[];
    편집된그룹: SvelteMap<Types.브랜드별마진그룹타입["uuid"], Types.브랜드별마진그룹타입>;
    마진그룹: Types.마진그룹타입;
    마진그룹선택된브랜드: Types.브랜드별마진그룹타입[];
    마진그룹갱신: boolean;
    마진설정보기팝업: HTMLElement | undefined;
    마진설정보기활성화: boolean;
    현재마진탭: string;
    선택된브랜드품목: Types.개별품목타입[];
    변경된행: SvelteMap<Types.개별품목타입["no_id"], Types.개별품목타입>;
    적용: () => Promise<void>;
  }

  const useDev = import.meta.env.MODE === "development";

  let { 앱요소, 선택된브랜드, 아이디목록, 편집된그룹, 마진그룹 = $bindable(), 마진그룹선택된브랜드 = $bindable(), 마진그룹갱신 = $bindable(), 마진설정보기팝업 = $bindable(), 마진설정보기활성화 = $bindable(), 현재마진탭 = $bindable(), 선택된브랜드품목, 변경된행, 적용 }: Props = $props();

  let 기본마진그룹아이디목록: Types.확장된아이디목록[] = $state([]);
  let 미공급업체아이디목록: Types.확장된아이디목록[] = $state([]);

  let 팝업창내용: { html: HTMLElement | undefined | null; label: string | undefined; useInput: boolean } = $state({
    html: undefined,
    label: undefined,
    useInput: true,
  });

  let swal: typeof Swal | undefined = $state();

  let groupMenu: {
    active: boolean;
    top: number;
    left: number;
    element: HTMLElement | undefined;
    item?: Types.브랜드별마진그룹타입;
  } = $state({
    active: false,
    top: 0,
    left: 0,
    element: undefined,
  });

  let modifier: string | undefined = $state(undefined);
  let lastSelected: number = $state(Number.NEGATIVE_INFINITY);

  let 드래그하고있는마진탭: Types.브랜드별마진그룹타입 | undefined = $state();

  let 마진탭들: Types.브랜드별마진그룹타입[] = $state([]);

  let 마진탭순서바꿈 = $state(false);

  $effect(() => {
    if (!아이디목록) return;
    기본마진그룹아이디목록 = structuredClone($state.snapshot(아이디목록));
  });

  $effect(() => {
    if (!선택된브랜드) return;

    const 아이디목록 = Array.isArray(기본마진그룹아이디목록) ? 기본마진그룹아이디목록 : [];

    const 설정된아이디 = new Set(마진그룹[선택된브랜드]?.flatMap(y => y.data?.map(d => d.mb_id)) || []);

    마진그룹선택된브랜드 = 선택된브랜드
      ? [
          {
            idx: 0,
            uuid: "default_margin",
            brand: 선택된브랜드,
            label: "기본마진",
            data: 미공급업체아이디목록,
            element: undefined,
            search: undefined,
          },
          ...(마진그룹[선택된브랜드]
            ?.filter(x => x.uuid != "default_margin")
            .map(x => ({ ...x, search: undefined }))
            .sort((a, b) => a.idx - b.idx) ?? []),
          {
            idx: 999,
            uuid: null,
            brand: 선택된브랜드,
            label: "미분류된 업체",
            data: 아이디목록.filter(x => !설정된아이디.has(x.mb_id)),
            element: undefined,
            search: undefined,
          },
        ]
      : [];
  });

  $effect(() => {
    if (마진그룹갱신) {
      마진그룹가져오기();
      마진그룹갱신 = false;
    }
  });

  $effect(() => {
    미공급업체아이디목록 = 선택된브랜드 ? (마진그룹[선택된브랜드]?.find(x => x.uuid == "default_margin")?.data ?? []) : [];
  });

  $effect(() => {
    if (선택된브랜드 && 마진그룹선택된브랜드.length) 마진탭들 = 마진그룹[선택된브랜드]?.filter(x => x.uuid !== "default_margin").sort((a, b) => a.idx - b.idx) ?? [];
  });
  async function 마진그룹가져오기() {
    마진그룹 = {};
    try {
      const 가져오기 = await fetch("https://b2b.soundcat.com/page/product_margin_group_update.php", {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "Use-Dev": String(useDev),
        },
      });

      if (!가져오기.ok) throw new Error("서버 접속 실패." + JSON.stringify(가져오기));

      const 결과: { [key: string]: any; data: Types.마진그룹타입 } = await 가져오기.json();
      if (결과.status != "success") throw new Error("서버 작업 실패." + JSON.stringify(결과));
      마진그룹 = 결과.data;
    } catch (e) {
      console.error(e);
      마진그룹 = {};
    }
  }

  async function 새마진그룹(uuid: string | null | undefined = undefined) {
    groupMenu.active = false;
    if (!선택된브랜드) return;
    swal = Swal;
    const popup = swal.fire({
      title: uuid ? `현재 마진그룹 복제` : `<code>${선택된브랜드}</code> 브랜드에 새 마진 그룹 추가`,
      showConfirmButton: false,
      showCancelButton: true,
      cancelButtonText: "취소(닫기)",
    });
    팝업창내용.html = swal.getHtmlContainer();

    try {
      if (!(await popup).isConfirmed) throw "Cancelled";

      if (!uuid) {
        swal.fire({
          title: "적용 중...",
          showConfirmButton: false,
          allowEscapeKey: false,
          allowOutsideClick: false,
        });
      }
      const response = await fetch("https://b2b.soundcat.com/page/product_margin_group_update.php", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Use-Dev": useDev ? "true" : "false",
        },
        body: JSON.stringify({
          label: 팝업창내용.label,
          brand: 선택된브랜드,
          idx: 마진그룹[선택된브랜드]?.length,
          data: [],
        }),
      });

      swal.clickConfirm();

      if (!response.ok) throw new Error("서버 접속 실패");

      const result = await response.json();

      await 마진그룹가져오기();

      if (result.status != "success") throw new Error(result.data);
      if (!uuid) {
        Swal.fire({
          icon: "success",
          title: "마진 그룹이 추가되었습니다.",
        });
      } else {
        const 추가된그룹아이디 = 마진그룹선택된브랜드.find(x => x.label == 팝업창내용.label)?.uuid;
        for (const 품목 of 선택된브랜드품목) {
          const 마진설정값 = 품목.default_margin;
          if (!추가된그룹아이디) throw "추가된 그룹 아이디 못찾음";
          마진설정값.per_group[추가된그룹아이디] = structuredClone($state.snapshot(마진설정값.per_group[uuid]));
          품목.edited = true;
          변경된행.set(품목.no_id, 품목);
        }

        현재마진탭 = 추가된그룹아이디 ?? uuid;

        swal.fire({
          icon: "success",
          title: "그룹이 복제되었습니다.",
          text: "창을 닫고 저장을 눌러서 적용시켜주세요.",
          confirmButtonText: "닫기",
        });
      }
    } catch (e) {
      if ((e as Error).message)
        Swal.fire({
          title: (e as Error).message,
          icon: "error",
        });
    } finally {
      팝업창내용.html = undefined;
      팝업창내용.label = undefined;
      swal = undefined;
    }
  }

  async function 그룹명편집(현재그룹명: string | undefined, uuid: string | null | undefined, idx: number) {
    if (!uuid) return;
    groupMenu.active = false;

    swal = Swal;
    const popup = swal.fire({
      title: `"<code>${현재그룹명}</code>" 그룹명 변경`,
      showConfirmButton: false,
      showCancelButton: true,
      cancelButtonText: "취소(닫기)",
    });
    팝업창내용.html = swal.getHtmlContainer();

    try {
      if (!(await popup).isConfirmed) throw "Cancelled";

      swal.fire({
        title: "적용 중...",
        showConfirmButton: false,
        allowEscapeKey: false,
        allowOutsideClick: false,
      });

      const response = await fetch("https://b2b.soundcat.com/page/product_margin_group_update.php?action=label", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "Use-Dev": useDev ? "true" : "false",
        },
        body: JSON.stringify({
          uuid,
          label: 팝업창내용.label,
          brand: 선택된브랜드,
          idx,
        }),
      });

      swal.clickConfirm();

      if (!response.ok) throw new Error("서버 접속 실패");

      const result = await response.json();

      if (result.status == "success")
        Swal.fire({
          icon: "success",
          title: "그룹명이 변경되었습니다.",
        });
      마진그룹가져오기();
    } catch (e) {
      console.error((e as Error).message);
    } finally {
      팝업창내용.html = undefined;
      팝업창내용.label = undefined;
      swal = undefined;
    }
  }

  async function 그룹삭제(현재그룹명: string | undefined, uuid: string | null | undefined) {
    if (!uuid) return;
    groupMenu.active = false;

    swal = Swal;
    const popup = swal.fire({
      title: `"<code>${현재그룹명}</code>" 그룹을 삭제하시겠습니까?`,
      showConfirmButton: false,
      showCancelButton: true,
      cancelButtonText: "취소(닫기)",
    });
    팝업창내용.useInput = false;
    팝업창내용.html = swal.getHtmlContainer();
    try {
      if (!(await popup).isConfirmed) throw "Cancelled";

      swal.fire({
        title: "적용 중...",
        showConfirmButton: false,
        allowEscapeKey: false,
        allowOutsideClick: false,
      });

      const response = await fetch("https://b2b.soundcat.com/page/product_margin_group_update.php?uuid=" + uuid, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          "Use-Dev": useDev ? "true" : "false",
        },
      });

      if (!response.ok) throw new Error("서버 접속 실패");

      const result = await response.json();

      await 마진그룹가져오기();

      현재마진탭 = "default_margin";

      for (const 품목 of 선택된브랜드품목) {
        const 마진설정값 = 품목.default_margin;
        if (!uuid) throw "삭제한 UUID 못찾음";
        delete 마진설정값.per_group[uuid];
        품목.edited = true;
        변경된행.set(품목.no_id, 품목);
      }

      swal.clickConfirm();

      await 적용();
    } catch (e) {
      console.error((e as Error).message);
    } finally {
      팝업창내용.html = undefined;
      팝업창내용.label = undefined;
      팝업창내용.useInput = true;
      swal = undefined;
    }
  }

  function 마진목록에서드래그작업(e: DragEvent, 마진탭: Types.브랜드별마진그룹타입) {
    if (!Array.isArray(마진탭.data)) return;
    const obj = {
      uuid: 마진탭.uuid ?? null,
      data: 마진탭.data.filter((x: Types.확장된아이디목록) => x.selected),
    };
    e.dataTransfer?.setData("text/plain", JSON.stringify(obj));
    const element = document.createElement("div");
    element.classList.add("dragging-container");
    for (const el of obj.data) {
      const item = document.createElement("div");
      item.classList.add("dragging-option");
      item.innerText = el.mb_nick;
      element.appendChild(item);
    }
    document.body.appendChild(element);
    e.dataTransfer?.setDragImage(element, 0, 0);
    let timeout = setTimeout(() => element.remove(), 0);
    return () => {
      clearTimeout(timeout);
      element.remove();
    };
  }

  let dragBoxIndex = $state(Number.NEGATIVE_INFINITY);

  function 드래그끝(e: DragEvent, 마진탭: Types.브랜드별마진그룹타입) {
    try {
      const data = JSON.parse(e.dataTransfer?.getData("text/plain") ?? "[]");

      if (!Array.isArray(마진탭.data)) 마진탭.data = [];

      if (data.uuid === 마진탭.uuid) return;
      const ids = 마진그룹선택된브랜드.find(x => x.uuid === data.uuid)?.data;

      if (!Array.isArray(data.data)) return;

      for (const element of 마진탭.data) {
        element.selected = false;
      }

      data.data.forEach((item: Types.확장된아이디목록) => {
        if (!(Array.isArray(ids) && Array.isArray(마진탭.data))) return;
        const index = ids.findIndex(x => x.mb_id == item.mb_id);
        if (index < 0) return;
        ids.splice(index, 1);
      });

      마진탭.data.splice(dragBoxIndex, 0, ...data.data);

      if (마진탭.uuid && 선택된브랜드)
        편집된그룹.set(마진탭.uuid, {
          ...마진탭,
          brand: 선택된브랜드,
          element: undefined,
        });

      const 기존마진그룹목록 = 마진그룹선택된브랜드.find(x => x.uuid == data.uuid);
      if (기존마진그룹목록 && data.uuid !== null) 편집된그룹.set(data.uuid, 기존마진그룹목록);
    } catch (e) {
      console.error(e);
    }
  }

  function 아이디검색필터(item: Types.아이디목록타입, 마진탭: Types.브랜드별마진그룹타입) {
    if (!마진탭.search) return true;
    if (item.mb_nick.toLowerCase().includes(마진탭.search.toString().toLowerCase())) return true;
  }

  function 마진탭드래그(e: DragEvent, 마진탭: Types.브랜드별마진그룹타입) {
    if (!마진탭.uuid) return;
    드래그하고있는마진탭 = 마진탭;
    if (e.currentTarget instanceof HTMLElement) e.dataTransfer?.setDragImage(e.currentTarget, e.offsetX, e.offsetY);
  }

  let timeout = $state(0);

  function 마진탭드래그오버(e: DragEvent, 마진탭: Types.브랜드별마진그룹타입) {
    if (!(드래그하고있는마진탭 && 마진탭.uuid != 드래그하고있는마진탭.uuid && 선택된브랜드)) return;
    if (timeout) return;
    const 기존마진탭인덱스 = 드래그하고있는마진탭.idx;
    const 새마진탭인덱스 = 마진탭.idx;
    const 대상 = 마진탭들.find(item => item.idx == 드래그하고있는마진탭?.idx);
    if (대상) 대상.idx = 새마진탭인덱스;
    드래그하고있는마진탭.idx = 새마진탭인덱스;
    마진탭.idx = 기존마진탭인덱스;
    마진탭들 = 마진탭들.sort((a, b) => a.idx - b.idx);
    마진탭순서바꿈 = true;

    timeout = setTimeout(() => {
      clearTimeout(timeout);
      timeout = 0;
    }, 50);

    e.stopPropagation();
  }

  async function 마진탭드래그끝() {
    드래그하고있는마진탭 = undefined;

    if (!마진탭순서바꿈) return;
    try {
      const swal = Swal;
      swal.fire({
        title: "적용 중...",
        showConfirmButton: false,
        allowEscapeKey: false,
        allowOutsideClick: false,
      });

      const response = await fetch("https://b2b.soundcat.com/page/product_margin_group_update.php?action=order", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "Use-Dev": useDev ? "true" : "false",
        },
        body: JSON.stringify(
          마진탭들.map(item => ({
            uuid: item.uuid,
            brand: item.brand,
            idx: item.idx,
          })),
        ),
      });

      if (!response.ok) throw new Error("서버 접속 실패");

      const result = await response.json();
      await 마진그룹가져오기();
      swal.clickConfirm();

      if (result.status != "success")
        Swal.fire({
          icon: "error",
          title: "그룹 순서 변경에 실패했습니다.",
        });
    } catch (e) {
      console.error((e as Error).message);
    }
  }

  function 도움말() {}

  onMount(async () => {
    await 마진그룹가져오기();
  });
</script>

<svelte:window
  onpointerdown={e => {
    if (groupMenu.active && groupMenu.element && e.target instanceof HTMLElement && !groupMenu.element.contains(e.target)) groupMenu.active = false;
  }}
  onkeydown={e => {
    modifier = e.ctrlKey || e.metaKey ? "add" : e.shiftKey ? "shift" : undefined;
  }}
  onkeyup={e => {
    modifier = e.ctrlKey || e.metaKey ? "add" : e.shiftKey ? "shift" : undefined;
  }} />
{#if 선택된브랜드}
  <ul class="app-groups">
    <li class="dedicated"><button aria-label="마진 설정 보기" title="마진 설정 보기" onclick={() => (마진설정보기활성화 = true)}><i class="far fa-window-restore"></i></button></li>
    <div class="gap"></div>
    <li class={[(현재마진탭 == "default_margin" || 현재마진탭 == undefined) && "active"]}>
      <a href="#default_margin" onclick={() => (현재마진탭 = "default_margin")} draggable="false">기본마진</a>
    </li>
    {#each 마진탭들 as 마진탭 (마진탭.uuid)}
      <li class={[현재마진탭 == 마진탭.uuid && "active"]} ondragstart={e => 마진탭드래그(e, 마진탭)} ondrop={마진탭드래그끝} animate:flip={{ duration: 200 }} draggable="true">
        <a href="#{마진탭.uuid}" onclick={() => (현재마진탭 = 마진탭.uuid ?? "default_margin")} ondragenter={e => 마진탭드래그오버(e, 마진탭)}>
          {마진탭.label}
          <button
            class="group-menu-btn"
            aria-label="그룹 메뉴"
            onclick={e => {
              if (!앱요소) return;
              const rect = e.currentTarget.getBoundingClientRect();
              const 앱요소의크기 = 앱요소.getBoundingClientRect();
              groupMenu.top = rect.y - 앱요소의크기.y;
              groupMenu.left = rect.x - 앱요소의크기.x;
              groupMenu.active = true;
              groupMenu.item = 마진탭;
            }}><i class="fas fa-ellipsis-v"></i></button>
        </a>
      </li>
    {/each}
    <div class="gap"></div>
    <li class="dedicated">
      <button onclick={() => 새마진그룹()} title="새 마진그룹 추가" class="new_group_btn">추가</button>
    </li>
  </ul>
{/if}
{#if groupMenu.active}
  <div
    bind:this={groupMenu.element}
    class="group-menu"
    style="top: {groupMenu.top}px; left: {groupMenu.left}px;"
    transition:fly={{ y: -10, duration: 200 }}
    {@attach () => {
      return () => {
        groupMenu.element = undefined;
        groupMenu.item = undefined;
      };
    }}>
    <button onclick={() => 그룹명편집(groupMenu.item?.label, groupMenu.item?.uuid, groupMenu.item?.idx ?? -1)}>마진 그룹명 변경</button>
    <button onclick={() => 새마진그룹(groupMenu.item?.uuid)}>마진 설정값 복제</button>
    <button onclick={() => 그룹삭제(groupMenu.item?.label, groupMenu.item?.uuid)}>마진 그룹 삭제</button>
  </div>
{/if}
{#if 팝업창내용.html}
  <Portal target={팝업창내용.html}>
    <form
      onsubmit={e => {
        e.preventDefault();
        if (swal) swal.clickConfirm();
      }}
      class="popup">
      {#if 팝업창내용.useInput}
        <label>
          <span class="text-within-label">그룹 이름: </span>
          <input
            class="group-name"
            type="text"
            bind:value={팝업창내용.label}
            required
            {@attach node => {
              setTimeout(() => node.select(), 0);
            }} />
        </label>
      {/if}
      <div style="margin-top: 1em;">
        <button class="button" type="submit">확인</button>
      </div>
    </form>
  </Portal>
{/if}
{#if 마진설정보기활성화 && 선택된브랜드}
  <Portal target="body">
    <div class="margin-popup-window">
      <div class="inner" bind:this={마진설정보기팝업} transition:scale={{ opacity: 0, start: 0.99, duration: 200 }}>
        <h2 class="title">{선택된브랜드} 브랜드 마진그룹</h2>
        <div class="select-section">
          {#each 마진그룹선택된브랜드 as 마진탭}
            <div class="selection-group">
              <div class="group-title">{마진탭.label}</div>
              <div class="group-search">
                <input type="text" bind:value={마진탭.search} placeholder="{마진탭.label} 그룹 내 검색..." {@attach () => (마진탭.search = undefined)} />
              </div>
              <div
                role="listbox"
                aria-multiselectable="true"
                tabindex="0"
                id={마진탭.uuid}
                bind:this={마진탭.element}
                ondragover={e => {
                  e.preventDefault();
                  if (e.target instanceof HTMLElement && e.target == 마진탭.element) dragBoxIndex = 마진탭.data?.length ?? -1;
                }}
                ondrop={e => 드래그끝(e, 마진탭)}>
                {#if Array.isArray(마진탭.data)}
                  {#each 마진탭.data.filter(item => 아이디검색필터(item, 마진탭)) as 아이디, 인덱스 (아이디.mb_id)}
                    <div
                      class:selected={아이디.selected}
                      role="option"
                      tabindex="0"
                      aria-selected="false"
                      draggable="true"
                      data-value={아이디.mb_id}
                      animate:flip={{ duration: 200 }}
                      ondragover={e => {
                        dragBoxIndex = 인덱스;
                      }}
                      ondragstart={e => {
                        if (!(typeof 마진탭.data == "object" && 마진탭.data != null)) return;
                        if (!Array.isArray(마진탭.data)) return;
                        if (!아이디.selected) {
                          마진탭.data.forEach(element => {
                            if (!Array.isArray(마진탭.data)) return;
                            if (!element.selected) return;
                            element.selected = false;
                          });
                          아이디.selected = true;
                        }
                        마진목록에서드래그작업(e, 마진탭);
                      }}
                      onclickcapture={e => {
                        if (!Array.isArray(마진탭.data)) return;

                        if (modifier != "add") {
                          for (const element of 마진탭.data) {
                            if (!element.selected) continue;
                            element.selected = false;
                          }
                        }
                        if (modifier == "shift") {
                          const start = Math.min(lastSelected, 인덱스);
                          const last = Math.max(lastSelected, 인덱스);
                          for (const element of 마진탭.data.filter(item => 아이디검색필터(item, 마진탭)).slice(start, last)) {
                            element.selected = true;
                          }
                        }
                        아이디.selected = true;

                        if (modifier != "shift") lastSelected = 인덱스;
                      }}
                      {@attach () => {
                        아이디.selected = false;
                      }}>
                      {아이디.mb_nick}
                    </div>
                  {/each}
                {/if}
              </div>
            </div>
          {/each}
        </div>
        <button class="close" aria-label="창닫기" title="창닫기" onclick={() => (마진설정보기활성화 = false)}><i class="fas fa-times"></i></button>
      </div>
    </div>
  </Portal>
{/if}

<style>
  @import "./common.css";
  @import "./Margin_Groups.css";
</style>
