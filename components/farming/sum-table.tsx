import {
  Table,
  TableBody,
  TableCell,
  TableRow,
} from '@/components/ui/table'
import React from 'react'

export const SumTable = ({
  rows,
}: {
  rows: { key: string; value: number | string; unit: string }[]
}) => (
  <Table>
    <TableBody>
      {rows.map(({ key, value, unit }) => (
        <TableRow key={key}>
          <TableCell>{key}</TableCell>
          <TableCell className="text-right">{value}</TableCell>
          <TableCell>{unit}</TableCell>
        </TableRow>
      ))}
    </TableBody>
  </Table>
)
