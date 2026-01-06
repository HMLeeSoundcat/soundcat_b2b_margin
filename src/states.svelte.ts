import * as Types from "./types";

interface States {
  마진그룹: Types.마진그룹타입;
  선택된브랜드: string | undefined;
  현재마진탭: string | undefined;
  마진설정보기활성화: boolean;
  마진설정보기팝업: HTMLElement | undefined;
}