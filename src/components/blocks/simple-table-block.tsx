"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { BlockContainer } from "./block-container";
import { type z } from "zod";
import type { blockSchemas } from "@/lib/blocks/types";
import type { Locale } from "@/lib/i18n";

export type SimpleTableBlockProps = z.input<typeof blockSchemas.simpleTable>["props"];

/** جدول بيانات بسيط بأسلوب بطاقات الموقع */
export function SimpleTableBlock({ props }: { props: SimpleTableBlockProps; locale: Locale }) {
  const headers = props.headers ?? [];
  const rows = props.rows ?? [];

  return (
    <BlockContainer>
      {props.caption && <p className="mb-3 text-sm font-semibold text-muted-foreground">{props.caption}</p>}
      <div className="overflow-hidden rounded-2xl border border-border bg-white">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              {headers.map((h, i) => (
                <TableHead key={`${i}-${h}`} className="px-5 py-3.5 text-start text-sm font-bold text-navy">
                  {h}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row, i) => (
              <TableRow key={i}>
                {row.map((cell, j) => (
                  <TableCell key={j} className="px-5 py-3.5 text-[15px] leading-7 text-muted-foreground">
                    {cell}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </BlockContainer>
  );
}
