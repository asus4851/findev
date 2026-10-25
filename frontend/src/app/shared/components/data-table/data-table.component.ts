import { ChangeDetectionStrategy, Component, PipeTransform, input } from '@angular/core';

// Колонка таблицы: какое поле строки показать, какой заголовок и как отформатировать значение.
export interface TableColumn<T> {
  field: keyof T & string;
  header: string;
  // Пайп для значения ячейки. Без него значение отображается как есть.
  pipe?: PipeTransform;
  // Числа выравниваются по правому краю.
  numeric?: boolean;
}

// Универсальная таблица: ничего не знает о данных, только показывает переданные колонки и строки.
// Первая колонка становится заголовком строки.
@Component({
  selector: 'app-data-table',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './data-table.component.html',
  styleUrl: './data-table.component.css',
})
export class DataTableComponent<T> {
  readonly columns = input.required<TableColumn<T>[]>();
  readonly rows = input.required<T[]>();
  // Поле, которое однозначно идентифицирует строку: по нему Angular обновляет строки вместо пересоздания.
  readonly rowKey = input.required<keyof T & string>();
  // Текст, пока строк нет.
  readonly emptyText = input('No data');

  protected cell(row: T, column: TableColumn<T>): string {
    const value = row[column.field];
    return String(column.pipe ? column.pipe.transform(value) : value);
  }
}
