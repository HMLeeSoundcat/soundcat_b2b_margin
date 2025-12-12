<script lang="ts">
  let { 품목목록 = $bindable(), 행업데이트 } = $props();
  import Swal from "sweetalert2";
  import { compressToUTF16, decompressFromUTF16 } from "lz-string";
  import Portal from "svelte-portal";

  let 팝업창열림여부: number | undefined = $state();
  let 팝업창: undefined | typeof Swal = $state();

  let 백업위치: number = $state(0);
  let 백업메모: string = $state("");

  let 파일선택기: HTMLInputElement | undefined = $state();
  let 업로드파일: FileList | undefined = $state();

  async function 복원동작() {
    팝업창 = Swal;
    const 팝업창결과 = await 팝업창.fire({
      icon: "question",
      html: "",
      customClass: {
        htmlContainer: "backupAndRestorePopup",
      },
      confirmButtonText: "다음",
      willOpen(popup) {
        팝업창열림여부 = 2;
      },
      didClose() {
        팝업창열림여부 = 0;
      },
    });

    if (팝업창결과.isConfirmed) {
      if (!백업위치)
        return Swal.fire({
          icon: "error",
          title: "복원 위치가 지정되지 않았습니다.",
          text: "복원 위치를 선택하고 확인을 눌러주세요.",
          confirmButtonText: "확인",
          didClose() {
            팝업창열림여부 = 0;
          },
        });
    }
  }

  async function 백업동작() {
    팝업창 = Swal;
    const 팝업창결과 = await 팝업창.fire({
      icon: "question",
      html: "",
      customClass: {
        htmlContainer: "backupAndRestorePopup",
      },
      confirmButtonText: "확인",
      willOpen(popup) {
        팝업창열림여부 = 1;
      },
      didClose() {
        팝업창열림여부 = 0;
      },
    });
    if (팝업창결과.isConfirmed) {
      if (!백업위치)
        return Swal.fire({
          icon: "error",
          title: "백업 위치가 지정되지 않았습니다.",
          text: "백업 위치를 선택하고 확인을 눌러주세요.",
          confirmButtonText: "확인",
          didClose() {
            팝업창열림여부 = 0;
          },
        });
      const 팝업창 = Swal;
      const 팝업창결과 = await 팝업창.fire({
        title: "백업중입니다...",
        allowOutsideClick: false,
        allowEscapeKey: false,
        showConfirmButton: false,
        async didOpen(popup) {
          if (백업위치 == 1) {
            const json = JSON.stringify(품목목록);
            const compressed = compressToUTF16(json);

            const blob = new Blob([compressed], { type: "text/plain" });
            const url = URL.createObjectURL(blob);

            const a = document.createElement("a");
            a.href = url;
            a.download = "data.lz";
            a.click();

            URL.revokeObjectURL(url);

            팝업창.clickConfirm();
          } else if (백업위치 == 2) {
            try {
              const 요청 = await fetch("https://b2b.soundcat.com/page/product_backup.php", {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  "Use-Dev": import.meta.env.MODE === "development" ? "true" : "false",
                },
                body: JSON.stringify({
                  content: 품목목록,
                  date: Date.now(),
                  memo: 백업메모,
                }),
              });

              if (!요청.ok) throw new Error("서버 접속에 실패했습니다.");

              const 결과 = await 요청.json();

              if (결과.status != "success") throw new Error(결과.data || "서버에서 성공 결과를 반환하지 않았습니다.");

              팝업창.clickConfirm();
            } catch (e) {
              팝업창.clickCancel();
              Swal.fire({
                icon: "error",
                title: "오류가 발생했습니다.",
                html: `<details><summary>자세히 보기</summary><code><pre>${JSON.stringify(e)}</pre></code></details>`,
              });
            }
          }
        },
      });

      if (팝업창결과.isConfirmed) {
        Swal.fire({
          icon: "success",
          title: `품목 목록을 ${백업위치 == 1 ? "백업하어 다운로드 폴더에 저장" : "서버에 백업"}하였습니다.`,
          confirmButtonText: "닫기",
        });
      }
      팝업창열림여부 = 0;
      백업위치 = 1;
      백업메모 = "";
    }
  }
</script>

<button
  onclick={복원동작}
  class="button restore">복원 <i class="fas fa-upload"></i></button>
<button
  onclick={백업동작}
  class="button backup">백업 <i class="fas fa-download"></i></button>

{#if 팝업창열림여부 == 1}
  <Portal target=".backupAndRestorePopup">
    <div>
      <h3>백업할 위치를 선택해주세요.</h3>
      <div>
        <label
          for="backupToLocal"
          class="app_radio">
          <i></i>내 컴퓨터<input
            id="backupToLocal"
            type="radio"
            bind:group={백업위치}
            value={1} /></label>
        <label
          for="backupToServer"
          class="app_radio">
          <i></i>서버<input
            id="backupToServer"
            type="radio"
            bind:group={백업위치}
            value={2} /></label>
      </div>
      {#if 백업위치 == 2}
        <hr />
        <div>백업 메모를 입력하시려면 입력해주세요.</div>
        <div>
          <input
            type="text"
            onkeydown={e => {
              e.key == "Enter" && 팝업창 ? 팝업창.clickConfirm() : undefined;
            }}
            bind:value={백업메모}
            placeholder="백업 메모...(선택)" />
        </div>
      {/if}
    </div>
  </Portal>
{:else if 팝업창열림여부 == 2}
  <Portal target=".backupAndRestorePopup">
    <div>
      <h3>어디로부터 데이터를 복원할까요?</h3>
      <div>
        <label
          for="backupToLocal"
          class="app_radio">
          <i></i>내 컴퓨터<input
            id="backupToLocal"
            type="radio"
            bind:group={백업위치}
            value={1} /></label>
        <label
          for="backupToServer"
          class="app_radio">
          <i></i>서버<input
            id="backupToServer"
            type="radio"
            bind:group={백업위치}
            value={2} /></label>
      </div>
      {#if 백업위치 == 1}
        <hr />
        <div
          onpointerup={() => {
            if (!(업로드파일 && 업로드파일.length == 1)) 파일선택기?.click();
          }}
          class={["filednd", !(업로드파일 && 업로드파일.length == 1) && "nofile"]}>
        </div>
        <input
          type="file"
          class="file"
          bind:this={파일선택기}
          bind:files={업로드파일} />
      {:else if 백업위치 == 2}
        <hr />
        <div>백업 메모를 입력하시려면 입력해주세요.</div>
        <div>
          <input
            type="text"
            onkeydown={e => {
              e.key == "Enter" && 팝업창 ? 팝업창.clickConfirm() : undefined;
            }}
            bind:value={백업메모}
            placeholder="백업 메모...(선택)" />
        </div>
      {/if}
    </div>
  </Portal>
{/if}

<style>
  @import "./Backup_Restore.css";
</style>
