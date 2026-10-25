import { ChangeDetectionStrategy, Component, PipeTransform, input } from '@angular/core';

// Колонка таблиці: яке поле рядка показати, який заголовок і як відформатувати значення.
export interface TableColumn<T> {
  field: keyof T & string;
  header: string;
  // Пайп для значення комірки. Без нього значення показується як є.
  pipe?: PipeTransform;
  // Числа вирівнюються по правому краю.
  numeric?: boolean;
}

// Універсальна таблиця: нічого не знає про дані, лише показує передані колонки і рядки.
// Перша колонка стає заголовком рядка.
@Component({
  selector: 'app-data-table',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './data-table.component.html',
  styleUrl: './data-table.component.css',
})
export class DataTable<T> {
  readonly columns = input.required<TableColumn<T>[]>();
  readonly rows = input.required<T[]>();
  // Поле, яке однозначно ідентифікує рядок: за ним Angular оновлює рядки замість перестворення.
  readonly rowKey = input.required<keyof T & string>();
  // Текст, поки рядків немає.
  readonly emptyText = input('No data');

  protected cell(row: T, column: TableColumn<T>): string {
    const value = row[column.field];
    return String(column.pipe ? column.pipe.transform(value) : value);
  }
}
