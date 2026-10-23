'use client';

import {
  BlockTypeSelect,
  BoldItalicUnderlineToggles,
  CodeToggle,
  CreateLink,
  InsertTable,
  InsertThematicBreak,
  ListsToggle,
  MDXEditor,
  UndoRedo,
  codeBlockPlugin,
  headingsPlugin,
  linkDialogPlugin,
  linkPlugin,
  listsPlugin,
  markdownShortcutPlugin,
  quotePlugin,
  tablePlugin,
  thematicBreakPlugin,
  toolbarPlugin,
  type Translation,
} from '@mdxeditor/editor';
import '@mdxeditor/editor/style.css';
import { useState } from 'react';

const ES: Record<string, string> = {
  'toolbar.undo': 'Deshacer {{shortcut}}',
  'toolbar.redo': 'Rehacer {{shortcut}}',
  'toolbar.bold': 'Negrita',
  'toolbar.removeBold': 'Quitar negrita',
  'toolbar.italic': 'Cursiva',
  'toolbar.removeItalic': 'Quitar cursiva',
  'toolbar.underline': 'Subrayado',
  'toolbar.removeUnderline': 'Quitar subrayado',
  'toolbar.inlineCode': 'Formato de código',
  'toolbar.removeInlineCode': 'Quitar formato de código',
  'toolbar.bulletedList': 'Lista con viñetas',
  'toolbar.numberedList': 'Lista numerada',
  'toolbar.checkList': 'Lista de tareas',
  'toolbar.link': 'Crear enlace',
  'toolbar.table': 'Insertar tabla',
  'toolbar.thematicBreak': 'Insertar línea divisoria',
  'toolbar.toggleGroup': 'grupo de opciones',
  'toolbar.blockTypeSelect.placeholder': 'Tipo de bloque',
  'toolbar.blockTypeSelect.selectBlockTypeTooltip': 'Elegir tipo de bloque',
  'toolbar.blockTypes.paragraph': 'Párrafo',
  'toolbar.blockTypes.quote': 'Cita',
  'toolbar.blockTypes.heading': 'Título {{level}}',
  'createLink.url': 'URL',
  'createLink.urlPlaceholder': 'Pega o escribe una dirección',
  'createLink.text': 'Texto del enlace',
  'createLink.textTooltip': 'El texto que se mostrará en el enlace',
  'createLink.title': 'Título del enlace',
  'createLink.saveTooltip': 'Guardar enlace',
  'createLink.cancelTooltip': 'Cancelar cambio',
  'linkPreview.edit': 'Editar enlace',
  'linkPreview.remove': 'Quitar enlace',
  'linkPreview.copyToClipboard': 'Copiar al portapapeles',
  'linkPreview.copied': '¡Copiado!',
  'dialogControls.save': 'Guardar',
  'dialogControls.cancel': 'Cancelar',
  'dialog.close': 'Cerrar',
  'table.columnMenu': 'Menú de columna',
  'table.rowMenu': 'Menú de fila',
  'table.textAlignment': 'Alineación del texto',
  'table.alignLeft': 'Alinear a la izquierda',
  'table.alignCenter': 'Centrar',
  'table.alignRight': 'Alinear a la derecha',
  'table.insertColumnLeft': 'Insertar columna a la izquierda',
  'table.insertColumnRight': 'Insertar columna a la derecha',
  'table.insertRowAbove': 'Insertar fila arriba',
  'table.insertRowBelow': 'Insertar fila abajo',
  'table.deleteColumn': 'Eliminar esta columna',
  'table.deleteRow': 'Eliminar esta fila',
  'table.deleteTable': 'Eliminar tabla',
  'codeblock.delete': 'Eliminar bloque de código',
  'codeBlock.language': 'Lenguaje del bloque de código',
  'codeBlock.selectLanguage': 'Elegir lenguaje',
  'contentArea.editableMarkdown': 'contenido editable',
};

const translation: Translation = (key, defaultValue, interpolations) => {
  const text = ES[key] ?? defaultValue;
  return text.replace(/\{\{(\w+)\}\}/g, (_, name) => String(interpolations?.[name] ?? ''));
};

/** Editor WYSIWYG de notas: lee y guarda markdown. */
export function NoteEditor({ markdown, onChange, id }: { markdown: string; onChange: (markdown: string) => void; id?: string }) {
  const [parseError, setParseError] = useState(false);

  // Si MDXEditor no entiende el markdown (p. ej. HTML crudo), se edita como texto plano sin perder nada
  if (parseError) {
    return (
      <div>
        <p role="alert" className="mb-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          Esta nota usa markdown que el editor visual no soporta. La editas como texto para no perder contenido.
        </p>
        <textarea id={id} rows={18} className="w-full resize-y font-mono" value={markdown} onChange={(e) => onChange(e.target.value)} />
      </div>
    );
  }

  return (
    <MDXEditor
      className="note-editor"
      contentEditableClassName="prose prose-zinc prose-sm max-w-none"
      markdown={markdown}
      translation={translation}
      onError={() => setParseError(true)}
      // el primer cambio es solo la normalización del markdown al abrir: no es una edición
      onChange={(md, initialNormalize) => { if (!initialNormalize) onChange(md); }}
      plugins={[
        headingsPlugin(),
        listsPlugin(),
        quotePlugin(),
        linkPlugin(),
        linkDialogPlugin(),
        tablePlugin(),
        thematicBreakPlugin(),
        codeBlockPlugin({ defaultCodeBlockLanguage: '' }),
        markdownShortcutPlugin(),
        toolbarPlugin({
          toolbarContents: () => (
            <>
              <UndoRedo />
              <BlockTypeSelect />
              <BoldItalicUnderlineToggles />
              <CodeToggle />
              <ListsToggle />
              <CreateLink />
              <InsertTable />
              <InsertThematicBreak />
            </>
          ),
        }),
      ]}
    />
  );
}
