import type { Field } from "@/components/forms";
export const studentFields: Field[] = [
  { name: "name", label: "Full name", required: true },
  { name: "email", label: "Email address", type: "email", required: true },
  { name: "rollNumber", label: "Roll number", required: true },
  { name: "department", label: "Department", required: true },
  {
    name: "semester",
    label: "Semester",
    type: "number",
    min: 1,
    max: 12,
    required: true,
  },
  { name: "phone", label: "Contact number" },
  {
    name: "password",
    label: "Password",
    type: "password",
    help: "12+ characters. Leave blank when editing to keep the existing password.",
  },
  { name: "active", label: "Account active", type: "checkbox" },
];
export const categoryFields: Field[] = [
  { name: "name", label: "Category name", required: true },
  { name: "description", label: "Description", type: "textarea" },
  { name: "archived", label: "Archived", type: "checkbox" },
];
export function bookFields(
  categories: { id: string; name: string }[],
  edit = false,
): Field[] {
  return [
    { name: "title", label: "Book title", required: true },
    { name: "author", label: "Author", required: true },
    { name: "isbn", label: "ISBN" },
    {
      name: "categoryId",
      label: "Category",
      type: "select",
      required: true,
      options: categories.map((c) => ({ value: c.id, label: c.name })),
    },
    { name: "publisher", label: "Publisher" },
    { name: "edition", label: "Edition" },
    {
      name: "year",
      label: "Publication year",
      type: "number",
      min: 1000,
      max: 2200,
    },
    { name: "shelf", label: "Shelf location", required: true },
    ...(!edit
      ? [
          {
            name: "copies",
            label: "Initial physical copies",
            type: "number",
            min: 1,
            max: 100,
            required: true,
          },
        ]
      : []),
    {
      name: "coverUrl",
      label: "Cover image URL",
      type: "url",
      help: "Optional HTTPS URL. A typographic cover appears when no image is provided.",
    },
    { name: "description", label: "Description", type: "textarea" },
  ];
}
export const staffFields: Field[] = [
  { name: "name", label: "Name", required: true },
  { name: "email", label: "Email", type: "email", required: true },
  {
    name: "role",
    label: "Role",
    type: "select",
    required: true,
    options: [
      { value: "LIBRARIAN", label: "Librarian" },
      { value: "ADMIN", label: "Administrator" },
    ],
  },
  {
    name: "password",
    label: "Password",
    type: "password",
    help: "12+ characters. Leave blank to retain password when editing.",
  },
  { name: "active", label: "Account active", type: "checkbox" },
];
