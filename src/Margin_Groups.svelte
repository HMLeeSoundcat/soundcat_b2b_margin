<script lang="ts">
  import { onMount } from "svelte";
  import Portal from "svelte-portal";
  import Swal from "sweetalert2";
  import * as Types from "./types";
  import { fly, scale } from "svelte/transition";
  import { SvelteMap } from "svelte/reactivity";

  interface Props {
    앱요소: HTMLElement | undefined;
    선택된브랜드: string | undefined;
    아이디목록: Types.확장된아이디목록[];
    편집된그룹: SvelteMap<Types.브랜드별마진그룹타입["uuid"], Types.브랜드별마진그룹타입>;
    마진그룹: Types.마진그룹타입;
    마진그룹초기화: boolean;
    마진설정보기팝업: HTMLElement | undefined;
    마진설정보기활성화: boolean;
    현재마진탭: string | null;
    선택된브랜드품목: Types.개별품목타입[];
  }

  const useDev = import.meta.env.MODE === "development";

  let { 앱요소, 선택된브랜드, 아이디목록, 편집된그룹, 마진그룹 = $bindable(), 마진그룹초기화 = $bindable(), 마진설정보기팝업 = $bindable(), 마진설정보기활성화 = $bindable(), 현재마진탭 = $bindable(), 선택된브랜드품목 = $bindable() }: Props = $props();

  let 기본마진그룹아이디목록 = new SvelteMap<Types.확장된아이디목록["mb_id"], Types.확장된아이디목록>();
  let 기타마진그룹아이디목록 = new SvelteMap<Types.확장된아이디목록["mb_id"], Types.확장된아이디목록>();
  let 마진그룹선택된브랜드: Types.브랜드별마진그룹타입[] = $state([]);

  $inspect(편집된그룹);

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

  let modifier = $state(false);

  $effect(() => {
    if (!아이디목록) return;
    아이디목록.forEach(element => {
      기본마진그룹아이디목록.set(element.mb_id, element);
    });
  });

  $effect(() => {
    마진그룹선택된브랜드 = 선택된브랜드
      ? [
          {
            uuid: null,
            label: "기본마진",
            data: 기본마진그룹아이디목록,
            element: undefined,
          },
          ...마진그룹[선택된브랜드],
          {
            uuid: "extra",
            label: "기타",
            data: 기타마진그룹아이디목록,
            element: undefined,
          },
        ]
      : [];
  });

  $effect(() => {
    if (마진그룹초기화) {
      마진그룹가져오기();
      마진그룹초기화 = false;
    }
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
      for (const 각그룹 in 마진그룹) {
        마진그룹[각그룹].forEach(element => {
          const 기존데이터 = element.data;
          if (!기존데이터) return (element.data = new SvelteMap());
          if (Array.isArray(기존데이터)) element.data = new SvelteMap(기존데이터.map(x => [x.mb_id, x]));
        });
      }
    } catch (e) {
      console.error(e);
      마진그룹 = {};
    }
  }

  async function 새마진그룹(e: UIEvent) {
    swal = Swal;
    const popup = swal.fire({
      title: `<code>${선택된브랜드}</code> 브랜드에 새 마진 그룹 추가`,
      showConfirmButton: false,
      showCancelButton: true,
      cancelButtonText: "취소(닫기)",
    });
    팝업창내용.html = swal.getHtmlContainer();

    try {
      if (!(await popup).isConfirmed) throw "Cancelled";

      const response = await fetch("https://b2b.soundcat.com/page/product_margin_group_update.php", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Use-Dev": useDev ? "true" : "false",
        },
        body: JSON.stringify({
          label: 팝업창내용.label,
          brand: 선택된브랜드,
        }),
      });

      if (!response.ok) throw new Error("서버 접속 실패");

      const result = await response.json();

      if (result.status == "success")
        Swal.fire({
          icon: "success",
          title: "마진 그룹이 추가되었습니다.",
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

  async function 그룹명편집(현재그룹명: string | undefined, uuid: string | null | undefined) {
    if (!(현재그룹명 && uuid)) return;
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
        }),
      });

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

  async function 그룹항목편집() {}

  async function 그룹삭제(현재그룹명: string | undefined, uuid: string | null | undefined) {
    if (!(현재그룹명 && uuid)) return;
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

      const response = await fetch("https://b2b.soundcat.com/page/product_margin_group_update.php?uuid=" + uuid, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          "Use-Dev": useDev ? "true" : "false",
        },
      });

      if (!response.ok) throw new Error("서버 접속 실패");

      const result = await response.json();

      if (result.status == "success")
        Swal.fire({
          icon: "success",
          title: "그룹이 삭제되었습니다.",
        });
      마진그룹가져오기();
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
    if (typeof 마진탭.data != "object" || 마진탭.data == null) return;
    const obj = {
      uuid: 마진탭.uuid ?? null,
      data: [...마진탭.data.values()].filter((x: Types.확장된아이디목록) => x.selected),
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
    setTimeout(() => element.remove(), 0);
  }

  function 드래그끝(e: DragEvent, 마진탭: Types.브랜드별마진그룹타입) {
    const data = JSON.parse(e.dataTransfer?.getData("text/plain") ?? "[]");

    if (!(마진탭.data instanceof Map)) 마진탭.data = new SvelteMap();

    if (data.uuid === 마진탭.uuid) return;
    const ids = 마진그룹선택된브랜드.find(x => x.uuid === data.uuid)?.data;

    if (!Array.isArray(data.data)) return;

    data.data.forEach((item: Types.확장된아이디목록) => {
      if (!(ids instanceof Map && 마진탭.data instanceof Map)) return;
      ids.delete(item.mb_id);
      item.selected = false;
      마진탭.data.set(item.mb_id, item);
    });

    if (마진탭.uuid) 편집된그룹.set(마진탭.uuid, 마진탭);
  }

  onMount(async () => {
    await 마진그룹가져오기();
  });
</script>

<svelte:window
  onpointerdown={e => {
    if (groupMenu.active && groupMenu.element && e.target instanceof HTMLElement && !groupMenu.element.contains(e.target)) groupMenu.active = false;
  }}
  onkeydown={e => {
    modifier = e.ctrlKey || e.metaKey;
  }}
  onkeyup={e => {
    modifier = e.ctrlKey || e.metaKey;
  }} />
{#if 선택된브랜드}
  <ul class="app-groups">
    <li><button aria-label="마진 설정 보기" title="마진 설정 보기" onclick={() => (마진설정보기활성화 = true)}><i class="far fa-window-restore"></i></button></li>
    <div class="gap"></div>
    <li class={[(현재마진탭 == "default" || 현재마진탭 == undefined) && "active"]}>
      <a href="#default" onclick={() => (현재마진탭 = null)}>기본마진</a>
    </li>
    {#each 마진그룹[선택된브랜드] as 마진탭 (마진탭.uuid)}
      <li class={[현재마진탭 == 마진탭.uuid && "active"]}>
        <a href="#{마진탭.uuid}" onclick={() => (현재마진탭 = 마진탭.uuid)}>
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
    <li class={[현재마진탭 == "etc" && "active"]}>
      <a href="#etc" onclick={() => (현재마진탭 = "etc")}>기타</a>
    </li>
    <li>
      <button onclick={새마진그룹}>+</button>
    </li>
    <li>
      <button aria-label="도움말"><i class="fas fa-question-circle"></i></button>
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
    <button onclick={() => 그룹명편집(groupMenu.item?.label, groupMenu.item?.uuid)}>마진 그룹명 변경</button>
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
          <input type="text" bind:value={팝업창내용.label} required />
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
              <div role="listbox" aria-multiselectable="true" tabindex="0" id={마진탭.uuid} bind:this={마진탭.element} ondragover={e => e.preventDefault()} ondrop={e => 드래그끝(e, 마진탭)}>
                {#if typeof 마진탭.data == "object" && 마진탭.data != null}
                  {#each [...마진탭.data.values()] as 아이디}
                    <div
                      class:selected={아이디.selected}
                      role="option"
                      tabindex="0"
                      aria-selected="false"
                      draggable="true"
                      data-value={아이디.mb_id}
                      ondragstart={e => {
                        if (!(typeof 마진탭.data == "object" && 마진탭.data != null)) return;
                        if (!아이디.selected) {
                          [...마진탭.data.values()].forEach(element => {
                            if (!(마진탭.data instanceof Map)) return;
                            if (!element.selected) return;
                            마진탭.data.set(element.mb_id, {
                              ...element,
                              selected: false,
                            });
                          });
                          if (!(마진탭.data instanceof Map)) return;
                          마진탭.data.set(아이디.mb_id, {
                            ...아이디,
                            selected: true,
                          });
                        }
                        마진목록에서드래그작업(e, 마진탭);
                      }}
                      onclickcapture={e => {
                        if (!(typeof 마진탭.data == "object" && 마진탭.data != null)) return;
                        if (!modifier)
                          [...마진탭.data.values()].forEach(element => {
                            if (!(마진탭.data instanceof Map)) return;
                            if (!element.selected) return;
                            마진탭.data.set(element.mb_id, {
                              ...element,
                              selected: false,
                            });
                          });
                        if (!(마진탭.data instanceof Map)) return;
                        마진탭.data.set(아이디.mb_id, {
                          ...아이디,
                          selected: true,
                        });
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
