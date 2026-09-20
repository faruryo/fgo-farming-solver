#!/usr/bin/env python3
"""
Atlas Academy API からクラスボードデータを抽出し、data/class-board/ に保存するスクリプト
"""
import urllib.request
import json
import os

CLASS_MAP = {
    1: 'saber',
    2: 'archer',
    3: 'lancer',
    4: 'rider',
    5: 'caster',
    6: 'assassin',
    7: 'berserker',
    8: 'extra1',
    9: 'extra2',
}

TORCH_MAP = {
    51: {'id': '51', 'name': '新星のトーチ'},
    52: {'id': '52', 'name': '明星のトーチ'},
    53: {'id': '53', 'name': '極星のトーチ'},
}


def main():
    os.makedirs('data/class-board', exist_ok=True)
    print('Fetching nice_class_board.json...')
    req = urllib.request.Request(
        'https://api.atlasacademy.io/export/JP/nice_class_board.json',
        headers={'User-Agent': 'Mozilla/5.0'},
    )
    with urllib.request.urlopen(req) as resp:
        nice_data = json.loads(resp.read().decode('utf-8'))

    nice_by_id = {b['id']: b for b in nice_data if b['id'] in CLASS_MAP}
    all_boards = {}

    for board_id, class_key in CLASS_MAP.items():
        print(f'Processing {class_key} (ID {board_id})...')
        raw_url = f'https://api.atlasacademy.io/raw/JP/class-board/{board_id}'
        raw_req = urllib.request.Request(
            raw_url, headers={'User-Agent': 'Mozilla/5.0'}
        )
        with urllib.request.urlopen(raw_req) as resp:
            raw_data = json.loads(resp.read().decode('utf-8'))

        raw_squares = {
            sq['id']: sq for sq in raw_data.get('mstClassBoardSquare', [])
        }
        raw_locks = {l['id']: l for l in raw_data.get('mstClassBoardLock', [])}
        nice_b = nice_by_id[board_id]

        processed_squares = []
        start_ids = []
        for sq in nice_b.get('squares', []):
            sq_id = sq['id']
            raw_sq = raw_squares.get(sq_id, {})
            lock_id = raw_sq.get('lockId', 0)
            is_lock = lock_id > 0
            is_start = 'start' in sq.get('flags', [])
            if is_start:
                start_ids.append(sq_id)

            items = []
            if is_lock:
                lock_info = raw_locks.get(lock_id, {})
                item_ids = lock_info.get('itemIds', [])
                item_nums = lock_info.get('itemNums', [])
                for tid, tnum in zip(item_ids, item_nums):
                    t_item = TORCH_MAP.get(
                        tid, {'id': str(tid), 'name': f'トーチ({tid})'}
                    )
                    items.append({
                        'id': t_item['id'],
                        'name': t_item['name'],
                        'amount': tnum,
                    })
            else:
                for it in sq.get('items', []):
                    item_obj = it.get('item', {})
                    items.append({
                        'id': str(item_obj.get('id', '')),
                        'name': item_obj.get('name', ''),
                        'amount': it.get('amount', 0),
                    })

            target_skill = sq.get('targetSkill', {}) or {}
            name = target_skill.get('name') or (
                'ツアーロック' if is_lock else 'サイン'
            )
            detail = target_skill.get('detail') or (
                'トーチを消費してルートを解放します。'
                if is_lock
                else ''
            )
            icon = sq.get('icon', '')
            if is_lock and not icon:
                icon = (
                    'https://static.atlasacademy.io/JP/ClassBoard/Icon/lock.png'
                )

            processed_squares.append({
                'id': sq_id,
                'posX': sq.get('posX', 0),
                'posY': sq.get('posY', 0),
                'icon': icon,
                'name': name,
                'detail': detail,
                'skillType': sq.get('skillType', 'none'),
                'flags': sq.get('flags', []),
                'isStart': is_start,
                'isLock': is_lock,
                'items': items,
            })

        processed_lines = []
        for line in nice_b.get('lines', []):
            processed_lines.append({
                'id': line['id'],
                'prev': line['prevSquareId'],
                'next': line['nextSquareId'],
            })

        board_obj = {
            'key': class_key,
            'id': board_id,
            'name': nice_b.get('name', class_key),
            'startSquareIds': start_ids,
            'squares': processed_squares,
            'lines': processed_lines,
        }

        out_file = f'data/class-board/{class_key}.json'
        with open(out_file, 'w', encoding='utf-8') as f:
            json.dump(board_obj, f, ensure_ascii=False, indent=2)
        all_boards[class_key] = board_obj

    with open('data/class-board/all-boards.json', 'w', encoding='utf-8') as f:
        json.dump(all_boards, f, ensure_ascii=False)
    print('Finished successfully!')


if __name__ == '__main__':
    main()
