export interface CustomReadingItem {
  word: string;
  reading: string;
  updatedAt?: string | null;
}

interface CustomReadingListProps {
  items: CustomReadingItem[];
  loading: boolean;
  error: string | null;
}

export function CustomReadingList({ items, loading, error }: CustomReadingListProps) {
  return (
    <section className="panel custom-reading-panel">
      <h2>登録済み読み方一覧</h2>
      {loading && <p className="custom-reading-help">読み込み中...</p>}
      {error && <p className="custom-reading-error">{error}</p>}
      {!loading && !error && items.length === 0 && (
        <p className="custom-reading-help">まだ登録データがありません。</p>
      )}
      {!loading && !error && items.length > 0 && (
        <div className="reading-list-wrap">
          <table className="reading-list-table">
            <thead>
              <tr>
                <th>単語</th>
                <th>読み方</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={`${item.word}-${item.reading}`}>
                  <td>{item.word}</td>
                  <td>{item.reading}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
