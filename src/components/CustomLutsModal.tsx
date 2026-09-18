import type { CustomEntry } from '../engine/lut';

interface Props {
  customs: CustomEntry[];
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}

export function CustomLutsModal({ customs, onRename, onDelete, onClose }: Props) {
  return (
    <div className="modal-back" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <span>커스텀 LUT</span>
          <button onClick={onClose}>닫기</button>
        </div>
        <div className="modal-body">
          {customs.length === 0 && (
            <p className="modal-empty">
              가져온 LUT가 없습니다.
              <br />
              메뉴의 "LUT 가져오기"로 .cube / .png 파일을 추가하세요.
            </p>
          )}
          {customs.map((c) => (
            <div className="lut-row" key={c.id}>
              <input
                value={c.name}
                onChange={(e) => onRename(c.id, e.target.value)}
                placeholder="필터 이름"
                spellCheck={false}
              />
              <button className="lut-del" onClick={() => onDelete(c.id)}>
                삭제
              </button>
            </div>
          ))}
          <div className="modal-foot">
            <p>
              가져온 LUT는 이 기기에 저장되며, 앱을 껐다 켜도 유지됩니다.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
