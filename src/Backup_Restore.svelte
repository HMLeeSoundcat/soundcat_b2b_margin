<script lang="ts">
  let { 품목목록 = $bindable(), 행업데이트 } = $props();
  import Swal from "sweetalert2";
  import { compressToUTF16, decompressFromUTF16 } from "lz-string";

  function 복원동작() {}

  function 백업동작() {}
</script>

<button class="button restore">복원 <i class="fas fa-upload"></i></button>
<button class="button backup">백업 <i class="fas fa-download"></i></button>

<style>
  @import "./Backup_Restore.css";
</style>
