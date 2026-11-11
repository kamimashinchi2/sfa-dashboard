import os
from dataclasses import dataclass, field
from pathlib import Path
from dotenv import load_dotenv

@dataclass
class Config:
    database_url: str
    secret: str
    echo_hash: str
    root: Path = Path('/var/lib/sfa')
    origin: str = 'https://92-5-230-55.sslip.io'
    answer_key_path: str = '/etc/sfa/answer-keys'
    approval_required: bool = False
    quiz_approved: int = 80
    quiz_partial: int = 60
    practical_approved: int = 80
    practical_partial: int = 65
    clean_weeks: int = 2
    bot_token: str = ''
    bot_username: str = ''
    admin_id: int = 0

    @classmethod
    def env(cls):
        load_dotenv(os.getenv('SFA_ENV','/etc/sfa/sfa.env'))
        c=cls(os.environ['DATABASE_URL'],os.environ['SFA_BRIDGE_SECRET'],os.environ['ECHO_API_KEY_HASH'],
              root=Path(os.getenv('SFA_DATA_DIR','/var/lib/sfa')),origin=os.getenv('SFA_SITE_ORIGIN','https://92-5-230-55.sslip.io'),
              answer_key_path=os.getenv('ANSWER_KEY_PATH','/etc/sfa/answer-keys'),approval_required=os.getenv('APPROVAL_REQUIRED','false').lower()=='true',
              bot_token=os.getenv('TELEGRAM_BOT_TOKEN',''),bot_username=os.getenv('TELEGRAM_BOT_USERNAME',''),admin_id=int(os.getenv('ADMIN_CHAT_ID','0') or '0'))
        if len(c.secret)<32 or len(c.echo_hash)!=64 or not c.origin.startswith('https://'): raise ValueError('Unsafe server configuration')
        return c
